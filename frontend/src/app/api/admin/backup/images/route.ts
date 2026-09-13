import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { getCurrentAdmin } from '@/lib/auth';
import { getUploadDir } from '@/lib/storage';

// Helper recursivo para añadir archivos al ZIP ignorando ocultos y de sistema
function addFolderToZip(zip: AdmZip, currentDir: string, zipPath: string = '') {
  if (!fs.existsSync(currentDir)) return;
  const items = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const item of items) {
    if (item.name.startsWith('.') || item.name === '__MACOSX') continue;
    const fullPath = path.join(currentDir, item.name);
    const relZipPath = zipPath ? `${zipPath}/${item.name}` : item.name;
    if (item.isDirectory()) {
      addFolderToZip(zip, fullPath, relZipPath);
    } else if (item.isFile()) {
      zip.addLocalFile(fullPath, zipPath);
    }
  }
}

// GET /api/admin/backup/images
export async function GET(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    const uploadDir = getUploadDir();
    if (!fs.existsSync(uploadDir)) {
      return NextResponse.json({ detail: 'Directorio de imágenes no encontrado' }, { status: 404 });
    }

    const zip = new AdmZip();
    addFolderToZip(zip, uploadDir, '');
    const zipBuffer = zip.toBuffer();

    const timestamp = new Date().toISOString().split('T')[0];
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="multimedia_perfumeria_${timestamp}.zip"`,
      },
    });
  } catch (error: any) {
    console.error('Export images error:', error);
    return NextResponse.json({ detail: error.message || 'Error al exportar imágenes' }, { status: 500 });
  }
}

// POST /api/admin/backup/images
export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file || !file.name.toLowerCase().endsWith('.zip')) {
      return NextResponse.json({ detail: 'El archivo debe ser un archivo comprimido en formato .zip' }, { status: 400 });
    }

    const uploadDir = getUploadDir();
    const buffer = Buffer.from(await file.arrayBuffer());

    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();

    // Filtrar entradas de sistema, __MACOSX y archivos ocultos (.DS_Store, etc.)
    const validFileEntries = zipEntries.filter(entry => {
      if (entry.isDirectory) return false;
      const name = entry.entryName;
      if (name.startsWith('__MACOSX') || name.includes('/__MACOSX/')) return false;
      const parts = name.split('/');
      const filename = parts[parts.length - 1];
      if (filename.startsWith('.') || filename.endsWith('.DS_Store')) return false;
      return true;
    });

    if (validFileEntries.length === 0) {
      return NextResponse.json({ detail: 'El archivo ZIP no contiene archivos multimedia válidos' }, { status: 400 });
    }

    // Detectar si todos los archivos están dentro de una carpeta raíz común contenedora (ej. "uploads/", "multimedia/", etc.)
    let rootPrefix = '';
    const firstParts = validFileEntries[0].entryName.split('/');
    if (firstParts.length > 2) {
      const candidatePrefix = firstParts[0] + '/';
      const allSharePrefix = validFileEntries.every(e => e.entryName.startsWith(candidatePrefix));
      if (allSharePrefix) {
        rootPrefix = candidatePrefix;
      }
    } else if (firstParts.length === 2) {
      const candidate = firstParts[0].toLowerCase();
      if (['uploads', 'upload', 'multimedia', 'backup', 'imagenes', 'images'].includes(candidate)) {
        const candidatePrefix = firstParts[0] + '/';
        const allSharePrefix = validFileEntries.every(e => e.entryName.startsWith(candidatePrefix));
        if (allSharePrefix) {
          rootPrefix = candidatePrefix;
        }
      }
    }

    let count = 0;
    for (const entry of validFileEntries) {
      let relativePath = rootPrefix ? entry.entryName.slice(rootPrefix.length) : entry.entryName;
      relativePath = relativePath.replace(/\.\./g, '').replace(/^\/+/, '');
      if (!relativePath) continue;

      // Si el archivo quedó en la raíz (sin subcarpeta de categoría), asignarlo a 'Otros'
      if (!relativePath.includes('/')) {
        relativePath = `Otros/${relativePath}`;
      }

      const destPath = path.join(uploadDir, relativePath);
      // Seguridad: prevenir directory traversal
      if (!destPath.startsWith(uploadDir)) continue;

      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      fs.writeFileSync(destPath, entry.getData());
      count++;
    }

    return NextResponse.json({
      status: 'success',
      message: `Se importaron ${count} archivo${count === 1 ? '' : 's'} correctamente`,
      importedCount: count,
    });
  } catch (error: any) {
    console.error('Import images error:', error);
    return NextResponse.json({ detail: error.message || 'Error al restaurar imágenes' }, { status: 500 });
  }
}
