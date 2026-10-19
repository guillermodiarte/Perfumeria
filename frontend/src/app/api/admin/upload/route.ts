import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getCurrentAdmin } from '@/lib/auth';
import { getUploadDir } from '@/lib/storage';
import { optimizeAndSaveFile } from '@/lib/imageOptimizer';

// POST /api/admin/upload
export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const requestedFolder = (formData.get('folder') as string) || 'Otros';
    const folder = requestedFolder.replace(/[^a-zA-Z0-9_-]/g, '') || 'Otros';

    if (!file) {
      return NextResponse.json({ detail: 'Archivo no proporcionado' }, { status: 400 });
    }

    const uploadDir = getUploadDir();
    const destDir = path.join(uploadDir, folder);
    fs.mkdirSync(destDir, { recursive: true });

    const timestamp = Date.now();
    const ext = path.extname(file.name).toLowerCase();
    const rawSafeName = file.name.replace(/\.\./g, '').replace(/[\/\\]/g, '');
    const safeName = `${timestamp}_${rawSafeName}`;

    let url = '';
    if (ext === '.pdf') {
      const filePath = path.join(destDir, safeName);
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(filePath, buffer);
      url = `/uploads/${folder}/${safeName}`;
    } else {
      const buffer = Buffer.from(await file.arrayBuffer());
      const { filename: finalName } = await optimizeAndSaveFile(buffer, safeName, destDir);
      url = `/uploads/${folder}/${finalName}`;
    }

    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('Error in general upload:', error);
    return NextResponse.json({ detail: error.message || 'Error al subir archivo' }, { status: 500 });
  }
}

