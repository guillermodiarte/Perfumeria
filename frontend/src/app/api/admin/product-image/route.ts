import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getCurrentAdmin } from '@/lib/auth';
import { getUploadDir } from '@/lib/storage';

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
    fs.mkdirSync(destDir, { recursive: true });

    const ts = Date.now().toString().slice(-6);
    const sanitizedName = file.name.replace(/\.\./g, '').replace(/[\/\\]/g, '');
    const safeName = `${ts}_${sanitizedName}`;
    const filePath = path.join(destDir, safeName);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    const sizeKb = (buffer.length / 1024).toFixed(2);
    const url = `/uploads/productos/${safeSub}/${safeName}`;

    return NextResponse.json({
      filename: safeName,
      category: `productos/${safeSub}`,
      url,
      size: `${sizeKb} KB`,
    });
  } catch (error: any) {
    console.error('Error uploading product image:', error);
    return NextResponse.json({ detail: error.message || 'Error al subir imagen' }, { status: 500 });
  }
}
