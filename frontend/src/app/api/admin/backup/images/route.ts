import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { getCurrentAdmin } from '@/lib/auth';
import { getUploadDir } from '@/lib/storage';

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
    zip.addLocalFolder(uploadDir);
    const zipBuffer = zip.toBuffer();

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="imagenes_backup.zip"',
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

    if (!file || !file.name.endsWith('.zip')) {
      return NextResponse.json({ detail: 'El archivo debe ser un archivo .zip' }, { status: 400 });
    }

    const uploadDir = getUploadDir();
    const buffer = Buffer.from(await file.arrayBuffer());

    const zip = new AdmZip(buffer);
    zip.extractAllTo(uploadDir, true);

    return NextResponse.json({
      status: 'success',
      message: 'Imágenes restauradas correctamente',
    });
  } catch (error: any) {
    console.error('Import images error:', error);
    return NextResponse.json({ detail: error.message || 'Error al restaurar imágenes' }, { status: 500 });
  }
}
