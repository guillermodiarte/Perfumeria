import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getCurrentAdmin } from '@/lib/auth';
import { getUploadDir } from '@/lib/storage';

// PUT /api/admin/media/move?category=...&filename=...
export async function PUT(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || '';
    const filename = searchParams.get('filename') || '';

    const body = await req.json();
    const newCategory = (body.new_category || body.newCategory || '').trim().replace(/\.\./g, '');

    const safeCategory = category.trim().replace(/\.\./g, '');
    const safeFilename = filename.trim().replace(/\.\./g, '').replace(/[\/\\]/g, '');

    const uploadDir = getUploadDir();
    const oldPath = path.join(uploadDir, safeCategory, safeFilename);
    const newDir = path.join(uploadDir, newCategory);
    const newPath = path.join(newDir, safeFilename);

    if (!fs.existsSync(oldPath) || !fs.statSync(oldPath).isFile()) {
      return NextResponse.json({ detail: 'File not found' }, { status: 404 });
    }

    fs.mkdirSync(newDir, { recursive: true });
    fs.renameSync(oldPath, newPath);

    return NextResponse.json({ status: 'success', message: 'File moved' });
  } catch (error: any) {
    console.error('Error moving media:', error);
    return NextResponse.json({ detail: error.message || 'Error al mover archivo' }, { status: 500 });
  }
}
