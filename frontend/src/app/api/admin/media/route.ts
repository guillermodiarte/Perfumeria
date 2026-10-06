import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getCurrentAdmin } from '@/lib/auth';
import { getUploadDir, getAllUploadDirs } from '@/lib/storage';
import { optimizeAndSaveFile } from '@/lib/imageOptimizer';

const ALLOWED_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif', '.bmp', '.ico',
  '.mp4', '.webm', '.pdf'
]);

// Helper to recursively walk a directory and gather all files
function walkDirectory(baseDir: string, currentRelDir = ''): Array<{
  filename: string;
  category: string;
  relPath: string;
  url: string;
  sizeKb: string;
  mtimeMs: number;
}> {
  const result: Array<{
    filename: string;
    category: string;
    relPath: string;
    url: string;
    sizeKb: string;
    mtimeMs: number;
  }> = [];

  const targetDir = currentRelDir ? path.join(baseDir, currentRelDir) : baseDir;
  if (!fs.existsSync(targetDir)) return result;

  try {
    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue; // ignore hidden files/dirs

      const relEntryPath = currentRelDir ? path.join(currentRelDir, entry.name) : entry.name;
      const normalizedRelPath = relEntryPath.replace(/\\/g, '/');

      if (entry.isDirectory()) {
        result.push(...walkDirectory(baseDir, relEntryPath));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ALLOWED_EXTS.has(ext)) {
          const fullPath = path.join(targetDir, entry.name);
          try {
            const stat = fs.statSync(fullPath);
            const sizeKb = (stat.size / 1024).toFixed(2);
            const category = currentRelDir ? currentRelDir.replace(/\\/g, '/') : 'Otros';
            result.push({
              filename: entry.name,
              category,
              relPath: normalizedRelPath,
              url: `/uploads/${normalizedRelPath}`,
              sizeKb: `${sizeKb} KB`,
              mtimeMs: stat.mtimeMs,
            });
          } catch {}
        }
      }
    }
  } catch (err) {
    console.error(`Error walking dir ${targetDir}:`, err);
  }

  return result;
}

// GET /api/admin/media?category=...
export async function GET(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const filterCategory = searchParams.get('category');

    const defaultCats = ['Avatares', 'Banners', 'BodySpray', 'Fondos', 'Iconos', 'Imágenes', 'Labiales', 'Logo', 'Otros', 'Perfumes'];
    const primaryUploadDir = getUploadDir();
    for (const cat of defaultCats) {
      const p = path.join(primaryUploadDir, cat);
      if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    }

    const uploadDirs = getAllUploadDirs();
    const seenRelPaths = new Set<string>();
    const allFiles: Array<{
      filename: string;
      category: string;
      url: string;
      size: string;
      mtimeMs: number;
    }> = [];

    const categoriesSet = new Set<string>(defaultCats);

    // Walk all upload directories
    for (const baseDir of uploadDirs) {
      const dirFiles = walkDirectory(baseDir);
      for (const item of dirFiles) {
        if (!seenRelPaths.has(item.relPath)) {
          seenRelPaths.add(item.relPath);
          categoriesSet.add(item.category);
          allFiles.push({
            filename: item.filename,
            category: item.category,
            url: item.url,
            size: item.sizeKb,
            mtimeMs: item.mtimeMs,
          });
        }
      }
    }

    // Sort newest first
    allFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);

    const categories = Array.from(categoriesSet).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

    // Filter if requested
    let filteredFiles = allFiles;
    if (filterCategory && filterCategory.trim() !== '' && filterCategory.toLowerCase() !== 'todo') {
      const target = filterCategory.trim().toLowerCase();
      filteredFiles = allFiles.filter(f => 
        f.category.toLowerCase() === target ||
        f.category.toLowerCase().startsWith(target + '/')
      );
    }

    return NextResponse.json({
      categories,
      files: filteredFiles.map(({ filename, category, url, size }) => ({
        filename,
        category,
        url,
        size,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching media:', error);
    return NextResponse.json({ detail: error.message || 'Error al obtener medios' }, { status: 500 });
  }
}

// POST /api/admin/media
export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const { searchParams } = new URL(req.url);
    const categoryParam = formData.get('category') as string || searchParams.get('category') || 'Otros';

    if (!file) {
      return NextResponse.json({ detail: 'Archivo no proporcionado' }, { status: 400 });
    }

    const safeCategory = categoryParam.trim().replace(/\.\./g, '').replace(/^\/+|\/+$/g, '') || 'Otros';
    const uploadDir = getUploadDir();
    const categoryDir = path.join(uploadDir, safeCategory);
    fs.mkdirSync(categoryDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    const { filename: finalName, sizeKb } = await optimizeAndSaveFile(buffer, file.name, categoryDir);

    const url = `/uploads/${safeCategory}/${finalName}`;

    return NextResponse.json({
      filename: finalName,
      category: safeCategory,
      url,
      size: `${sizeKb} KB`,
    });
  } catch (error: any) {
    console.error('Error uploading media:', error);
    return NextResponse.json({ detail: error.message || 'Error al subir archivo' }, { status: 500 });
  }
}

// Helper to delete a file from all upload directories
function removeMediaFile(category: string, filename: string): boolean {
  const safeCategory = (category || '').trim().replace(/\.\./g, '').replace(/^\/+|\/+$/g, '');
  const safeFilename = (filename || '').trim().replace(/\.\./g, '').replace(/[\/\\]/g, '');

  if (!safeFilename) return false;

  let deletedAny = false;
  const uploadDirs = getAllUploadDirs();

  for (const baseDir of uploadDirs) {
    const candidates = [
      path.join(baseDir, safeCategory, safeFilename),
      path.join(baseDir, safeFilename),
    ];

    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        try {
          const stat = fs.statSync(filePath);
          if (stat.isFile()) {
            fs.unlinkSync(filePath);
            deletedAny = true;
          }
        } catch (e) {
          console.error(`Error unlinking ${filePath}:`, e);
        }
      }
    }
  }

  return deletedAny;
}

// DELETE /api/admin/media (supports single via query params, or bulk via body)
export async function DELETE(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    let filesToDelete: Array<{ category: string; filename: string }> = [];

    // Check if body was provided (bulk delete)
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const body = await req.json();
        if (Array.isArray(body.files)) {
          filesToDelete = body.files;
        } else if (Array.isArray(body.items)) {
          filesToDelete = body.items;
        }
      } catch {}
    }

    // Otherwise check query params (single delete)
    if (filesToDelete.length === 0) {
      const { searchParams } = new URL(req.url);
      const category = searchParams.get('category') || '';
      const filename = searchParams.get('filename') || '';
      if (filename) {
        filesToDelete.push({ category, filename });
      }
    }

    if (filesToDelete.length === 0) {
      return NextResponse.json({ detail: 'No se especificaron archivos para eliminar' }, { status: 400 });
    }

    let deletedCount = 0;
    for (const item of filesToDelete) {
      const ok = removeMediaFile(item.category, item.filename);
      if (ok) deletedCount++;
    }

    return NextResponse.json({
      status: 'success',
      deleted: deletedCount,
      totalRequested: filesToDelete.length,
      message: `${deletedCount} archivo(s) eliminado(s) con éxito`,
    });
  } catch (error: any) {
    console.error('Error deleting media:', error);
    return NextResponse.json({ detail: error.message || 'Error al eliminar archivo' }, { status: 500 });
  }
}
