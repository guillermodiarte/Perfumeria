import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { getCurrentAdmin } from '@/lib/auth';
import { getUploadDir } from '@/lib/storage';
import { optimizeAndSaveFile } from '@/lib/imageOptimizer';

// POST /api/admin/product-image
// All product images go to uploads/Productos/ (single flat folder)
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
    const destDir = path.join(uploadDir, 'Productos');

    const ts = Date.now().toString().slice(-6);
    const sanitizedName = file.name.replace(/\.\./g, '').replace(/[\/\\]/g, '');
    const initialName = `${ts}_${sanitizedName}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { filename: finalName, sizeKb } = await optimizeAndSaveFile(buffer, initialName, destDir);

    const url = `/uploads/Productos/${finalName}`;

    return NextResponse.json({
      filename: finalName,
      category: 'Productos',
      url,
      size: `${sizeKb} KB`,
    });
  } catch (error: any) {
    console.error('Error uploading product image:', error);
    return NextResponse.json({ detail: error.message || 'Error al subir imagen' }, { status: 500 });
  }
}

