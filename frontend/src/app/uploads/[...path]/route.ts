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
    const relPath = params.path.join('/');
    const filePath = path.join(uploadDir, ...params.path);

    // Prevent directory traversal
    if (!filePath.startsWith(uploadDir)) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // Directorios donde buscar archivos (volumen persistente, fallback inicial, o estáticos de public)
    const cwd = process.cwd();
    const candidateDirs = [
      uploadDir,
      path.join(cwd, 'public', 'uploads'),
      '/app/uploads_init',
      path.join(cwd, 'uploads_init'),
      path.resolve(cwd, '..', 'uploads'),
      path.resolve(cwd, 'uploads'),
    ];

    const findCandidate = (extTarget?: string): string | null => {
      let targetRel = relPath;
      if (extTarget) {
        const lastDot = relPath.lastIndexOf('.');
        targetRel = (lastDot !== -1 ? relPath.substring(0, lastDot) : relPath) + extTarget;
      }

      for (const dir of candidateDirs) {
        if (!dir || !fs.existsSync(dir)) continue;
        const candidatePath = path.join(dir, targetRel);
        if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
          return candidatePath;
        }
      }
      return null;
    };

    let finalPath = filePath;
    let ext = path.extname(filePath).toLowerCase();

    // 1. Si se solicita JPG/PNG pero existe versión WebP, preferir WebP
    if (['.jpg', '.jpeg', '.png'].includes(ext)) {
      const webpFile = findCandidate('.webp');
      if (webpFile) {
        finalPath = webpFile;
        ext = '.webp';
      }
    }

    // 2. Si no existe en la ruta directa, buscar en carpetas candidatas
    if (!fs.existsSync(finalPath) || !fs.statSync(finalPath).isFile()) {
      const foundDirect = findCandidate();
      if (foundDirect) {
        finalPath = foundDirect;
      } else if (ext === '.webp') {
        // Si piden WebP y no está, buscar si en el servidor quedó el original JPG/PNG
        for (const fallbackExt of ['.jpeg', '.jpg', '.png']) {
          const fallbackFile = findCandidate(fallbackExt);
          if (fallbackFile) {
            finalPath = fallbackFile;
            ext = fallbackExt;
            break;
          }
        }
      }
    }

    // Si finalmente no existe en ningún lado
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
