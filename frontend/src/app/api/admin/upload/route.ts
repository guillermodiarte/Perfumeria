import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getCurrentAdmin } from '@/lib/auth';
import { getUploadDir } from '@/lib/storage';

// POST /api/admin/upload
export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ detail: 'Archivo no proporcionado' }, { status: 400 });
    }

    const uploadDir = getUploadDir();
    const destDir = path.join(uploadDir, 'Otros');
    fs.mkdirSync(destDir, { recursive: true });

    const safeName = file.name.replace(/\.\./g, '').replace(/[\/\\]/g, '');
    const filePath = path.join(destDir, safeName);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    const url = `/uploads/Otros/${safeName}`;
    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('Error in general upload:', error);
    return NextResponse.json({ detail: error.message || 'Error al subir archivo' }, { status: 500 });
  }
}
