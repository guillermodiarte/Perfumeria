import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin, hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/admin/admins  - list all admins
export async function GET(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  const admins = await prisma.admin.findMany({ orderBy: { id: 'asc' } });
  return NextResponse.json(admins.map(a => ({ id: a.id, email: a.email, name: a.name, role: a.role })));
}

// DELETE /api/admin/admins  (with ?id=...)
export async function DELETE(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get('id') || '0');
  if (!id) return NextResponse.json({ detail: 'ID requerido' }, { status: 422 });

  if (admin.id === id) return NextResponse.json({ detail: 'No puedes eliminar tu propio usuario' }, { status: 400 });

  try {
    await prisma.admin.delete({ where: { id } });
    return NextResponse.json({ status: 'deleted' });
  } catch {
    return NextResponse.json({ detail: 'Error eliminando administrador' }, { status: 500 });
  }
}
