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

    if (!file) {
      return NextResponse.json({ detail: 'Archivo no proporcionado' }, { status: 400 });
    }

    const uploadDir = getUploadDir();
    const destDir = path.join(uploadDir, 'Otros');

    const buffer = Buffer.from(await file.arrayBuffer());
    const { filename: finalName } = await optimizeAndSaveFile(buffer, file.name, destDir);

    const url = `/uploads/Otros/${finalName}`;
    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('Error in general upload:', error);
    return NextResponse.json({ detail: error.message || 'Error al subir archivo' }, { status: 500 });
  }
}
