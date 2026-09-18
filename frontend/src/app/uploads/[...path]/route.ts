import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getUploadDir } from '@/lib/storage';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
};

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  try {
    const uploadDir = getUploadDir();
    const filePath = path.join(uploadDir, ...params.path);

    // Prevent directory traversal
    if (!filePath.startsWith(uploadDir)) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    let finalPath = filePath;
    let ext = path.extname(filePath).toLowerCase();

    // Si se solicita JPG/PNG y existe su equivalente WebP optimizado, servir WebP automáticamente
    if (['.jpg', '.jpeg', '.png'].includes(ext)) {
      const webpPath = filePath.substring(0, filePath.lastIndexOf('.')) + '.webp';
      if (fs.existsSync(webpPath) && fs.statSync(webpPath).isFile()) {
        finalPath = webpPath;
        ext = '.webp';
      }
    }

    if (!fs.existsSync(finalPath) || !fs.statSync(finalPath).isFile()) {
      return new NextResponse('Not Found', { status: 404 });
    }

    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const fileBuffer = fs.readFileSync(finalPath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving upload:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
