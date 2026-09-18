import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getCurrentAdmin } from '@/lib/auth';
import { getUploadDir } from '@/lib/storage';
import { optimizeAndSaveFile } from '@/lib/imageOptimizer';

// POST /api/admin/product-image?subcategory=...
export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const { searchParams } = new URL(req.url);
    const subcategoryParam = formData.get('subcategory') as string || searchParams.get('subcategory') || 'General';

    if (!file) {
      return NextResponse.json({ detail: 'Archivo no proporcionado' }, { status: 400 });
    }

    const safeSub = subcategoryParam.trim().replace(/\.\./g, '').replace(/[\/\\]/g, '') || 'General';
    const uploadDir = getUploadDir();
    const destDir = path.join(uploadDir, 'productos', safeSub);

    const ts = Date.now().toString().slice(-6);
    const sanitizedName = file.name.replace(/\.\./g, '').replace(/[\/\\]/g, '');
    const initialName = `${ts}_${sanitizedName}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { filename: finalName, sizeKb } = await optimizeAndSaveFile(buffer, initialName, destDir);

    const url = `/uploads/productos/${safeSub}/${finalName}`;

    return NextResponse.json({
      filename: finalName,
      category: `productos/${safeSub}`,
      url,
      size: `${sizeKb} KB`,
    });
  } catch (error: any) {
    console.error('Error uploading product image:', error);
    return NextResponse.json({ detail: error.message || 'Error al subir imagen' }, { status: 500 });
  }
}
