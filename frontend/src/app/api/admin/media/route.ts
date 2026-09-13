import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getCurrentAdmin } from '@/lib/auth';
import { getUploadDir } from '@/lib/storage';

// GET /api/admin/media?category=...
export async function GET(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const filterCategory = searchParams.get('category');
    const uploadDir = getUploadDir();

    const mediaFiles: any[] = [];
    let categories: string[] = [];

    const defaultCats = ['Imágenes', 'Fondos', 'Avatares', 'Videos', 'Otros'];
    for (const cat of defaultCats) {
      const p = path.join(uploadDir, cat);
      if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    }

    const entries = fs.readdirSync(uploadDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const catName = entry.name;
      const catPath = path.join(uploadDir, catName);

      const subEntries = fs.readdirSync(catPath, { withFileTypes: true });
      const hasSubdirs = subEntries.some(e => e.isDirectory());

      if (hasSubdirs) {
        for (const sub of subEntries) {
          if (!sub.isDirectory()) continue;
          const subCat = `${catName}/${sub.name}`;
          const subPath = path.join(catPath, sub.name);

          if (!filterCategory || filterCategory === subCat || filterCategory === catName) {
            categories.push(subCat);
            const files = fs.readdirSync(subPath, { withFileTypes: true });
            for (const f of files) {
              if (f.isFile() && !f.name.startsWith('.')) {
                const stat = fs.statSync(path.join(subPath, f.name));
                const sizeKb = (stat.size / 1024).toFixed(2);
                mediaFiles.push({
                  filename: f.name,
                  category: subCat,
                  url: `/uploads/${catName}/${sub.name}/${f.name}`,
                  size: `${sizeKb} KB`,
                });
              }
            }
          }
        }
      } else {
        if (!filterCategory || filterCategory === catName) {
          categories.push(catName);
          for (const f of subEntries) {
            if (f.isFile() && !f.name.startsWith('.')) {
              const stat = fs.statSync(path.join(catPath, f.name));
              const sizeKb = (stat.size / 1024).toFixed(2);
              mediaFiles.push({
                filename: f.name,
                category: catName,
                url: `/uploads/${catName}/${f.name}`,
                size: `${sizeKb} KB`,
              });
            }
          }
        }
      }
    }

    if (filterCategory) {
      categories = categories.filter(c => c === filterCategory);
    } else {
      categories = Array.from(new Set(categories)).sort();
    }

    return NextResponse.json({ categories, files: mediaFiles });
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

    const safeName = file.name.replace(/\.\./g, '').replace(/[\/\\]/g, '');
    const filePath = path.join(categoryDir, safeName);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    const sizeKb = (buffer.length / 1024).toFixed(2);
    const url = `/uploads/${safeCategory}/${safeName}`;

    return NextResponse.json({
      filename: safeName,
      category: safeCategory,
      url,
      size: `${sizeKb} KB`,
    });
  } catch (error: any) {
    console.error('Error uploading media:', error);
    return NextResponse.json({ detail: error.message || 'Error al subir archivo' }, { status: 500 });
  }
}

// DELETE /api/admin/media?category=...&filename=...
export async function DELETE(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || '';
    const filename = searchParams.get('filename') || '';

    const safeCategory = category.trim().replace(/\.\./g, '');
    const safeFilename = filename.trim().replace(/\.\./g, '').replace(/[\/\\]/g, '');

    const uploadDir = getUploadDir();
    const filePath = path.join(uploadDir, safeCategory, safeFilename);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      fs.unlinkSync(filePath);
      return NextResponse.json({ status: 'success', message: 'File deleted' });
    } else {
      return NextResponse.json({ detail: 'File not found' }, { status: 404 });
    }
  } catch (error: any) {
    console.error('Error deleting media:', error);
    return NextResponse.json({ detail: error.message || 'Error al eliminar archivo' }, { status: 500 });
  }
}
