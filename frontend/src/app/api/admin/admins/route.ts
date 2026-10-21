export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin, hashPassword, isSuperAdmin, PROTECTED_SUPER_ADMIN_EMAIL, VALID_ADMIN_ROLES } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/admin/admins  - list all admins
export async function GET(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });
  if (!isSuperAdmin(admin)) {
    return NextResponse.json({ detail: 'Solo el Super Administrador puede ver la lista de administradores' }, { status: 403 });
  }

  const admins = await prisma.admin.findMany({ orderBy: { id: 'asc' } });
  return NextResponse.json(admins.map(a => ({ id: a.id, email: a.email, name: a.name, role: a.role })));
}

// POST /api/admin/admins - crear nuevo administrador
export async function POST(req: NextRequest) {
  const currentAdmin = await getCurrentAdmin(req);
  if (!currentAdmin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });
  if (!isSuperAdmin(currentAdmin)) {
    return NextResponse.json({ detail: 'Solo el Super Administrador puede crear administradores' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { email, password, name, role } = body;

    if (!email || !email.trim()) {
      return NextResponse.json({ detail: 'El correo electrónico es requerido' }, { status: 400 });
    }
    if (!password || !password.trim()) {
      return NextResponse.json({ detail: 'La contraseña es requerida' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanRole = (role || 'admin').trim();

    if (!VALID_ADMIN_ROLES.includes(cleanRole)) {
      return NextResponse.json({ detail: `Rol inválido. Roles permitidos: ${VALID_ADMIN_ROLES.join(', ')}` }, { status: 400 });
    }

    const existing = await prisma.admin.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return NextResponse.json({ detail: 'Este correo ya está registrado como administrador' }, { status: 400 });
    }

    const newAdmin = await prisma.admin.create({
      data: {
        email: cleanEmail,
        name: (name || '').trim() || 'Admin',
        password_hash: hashPassword(password.trim()),
        role: cleanRole,
      },
    });

    return NextResponse.json({
      id: newAdmin.id,
      email: newAdmin.email,
      name: newAdmin.name,
      role: newAdmin.role,
    });
  } catch (error: any) {
    console.error('Error al crear admin:', error);
    return NextResponse.json({ detail: `Error al crear administrador: ${error?.message || 'Error desconocido'}` }, { status: 500 });
  }
}

// DELETE /api/admin/admins  (with ?id=...)
export async function DELETE(req: NextRequest) {
  const currentAdmin = await getCurrentAdmin(req);
  if (!currentAdmin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });
  if (!isSuperAdmin(currentAdmin)) {
    return NextResponse.json({ detail: 'Solo el Super Administrador puede eliminar administradores' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get('id') || '0');
  if (!id) return NextResponse.json({ detail: 'ID requerido' }, { status: 422 });

  if (currentAdmin.id === id) return NextResponse.json({ detail: 'No puedes eliminar tu propio usuario' }, { status: 400 });

  const target = await prisma.admin.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ detail: 'Administrador no encontrado' }, { status: 404 });

  if (target.email.toLowerCase() === PROTECTED_SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ detail: 'No se puede eliminar la cuenta principal del sistema' }, { status: 403 });
  }

  try {
    await prisma.admin.delete({ where: { id } });
    return NextResponse.json({ status: 'deleted' });
  } catch {
    return NextResponse.json({ detail: 'Error eliminando administrador' }, { status: 500 });
  }
}
