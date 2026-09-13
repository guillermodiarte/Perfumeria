import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getCurrentAdmin } from '@/lib/auth';

function getDbPath(): string {
  const envUrl = process.env.DATABASE_URL || '';
  if (envUrl.startsWith('file:')) {
    const rel = envUrl.replace('file:', '');
    if (path.isAbsolute(rel)) return rel;
    const p1 = path.join(process.cwd(), 'prisma', rel);
    if (fs.existsSync(p1)) return p1;
    const p2 = path.join(process.cwd(), rel);
    if (fs.existsSync(p2)) return p2;
    return p1;
  }
  return path.join(process.cwd(), 'prisma', 'dev.db');
}

// GET /api/admin/backup/db
export async function GET(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    const dbPath = getDbPath();
    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ detail: 'Base de datos no encontrada' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(dbPath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="perfumeria_backup.db"',
      },
    });
  } catch (error: any) {
    console.error('Export DB error:', error);
    return NextResponse.json({ detail: error.message || 'Error al exportar base de datos' }, { status: 500 });
  }
}

// POST /api/admin/backup/db
export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file || !file.name.endsWith('.db')) {
      return NextResponse.json({ detail: 'El archivo debe ser un archivo .db de SQLite' }, { status: 400 });
    }

    const dbPath = getDbPath();
    const buffer = Buffer.from(await file.arrayBuffer());

    // Write to DB file
    fs.writeFileSync(dbPath, buffer);

    return NextResponse.json({
      status: 'success',
      message: 'Base de datos restaurada correctamente',
    });
  } catch (error: any) {
    console.error('Import DB error:', error);
    return NextResponse.json({ detail: error.message || 'Error al restaurar base de datos' }, { status: 500 });
  }
}
