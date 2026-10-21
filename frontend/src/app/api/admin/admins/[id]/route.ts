export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin, hashPassword, isSuperAdmin, PROTECTED_SUPER_ADMIN_EMAIL, VALID_ADMIN_ROLES } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// PUT /api/admin/admins/[id] - Editar administrador (cambiar rol, nombre, password)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const currentAdmin = await getCurrentAdmin(req);
  if (!currentAdmin) {
    return NextResponse.json({ detail: 'No autorizado. Iniciá sesión como administrador.' }, { status: 401 });
  }

  // Solo super_admin puede editar administradores
  if (!isSuperAdmin(currentAdmin)) {
    return NextResponse.json({ detail: 'Solo el Super Administrador puede editar cuentas de administrador.' }, { status: 403 });
  }

  try {
    const adminId = parseInt(params.id);
    if (isNaN(adminId)) {
      return NextResponse.json({ detail: 'ID de administrador inválido.' }, { status: 400 });
    }

    const targetAdmin = await prisma.admin.findUnique({ where: { id: adminId } });
    if (!targetAdmin) {
      return NextResponse.json({ detail: 'Administrador no encontrado.' }, { status: 404 });
    }

    const body = await req.json();
    const { name, email, role, password } = body;

    const isTargetProtected = targetAdmin.email.toLowerCase() === PROTECTED_SUPER_ADMIN_EMAIL;

    // Protección de la cuenta principal
    if (isTargetProtected) {
      if (role && role !== 'super_admin') {
        return NextResponse.json({ detail: 'No se puede cambiar el rol de la cuenta principal del sistema.' }, { status: 403 });
      }
      if (email && email.trim().toLowerCase() !== PROTECTED_SUPER_ADMIN_EMAIL) {
        return NextResponse.json({ detail: 'No se puede cambiar el correo de la cuenta principal del sistema.' }, { status: 403 });
      }
    }

    const updateData: any = {};

    if (name !== undefined) {
      updateData.name = (name || '').trim();
    }

    if (email && email.trim()) {
      const cleanEmail = email.trim().toLowerCase();
      // Verificar que no esté en uso por otro admin
      if (cleanEmail !== targetAdmin.email.toLowerCase()) {
        const existOther = await prisma.admin.findUnique({ where: { email: cleanEmail } });
        if (existOther && existOther.id !== adminId) {
          return NextResponse.json({ detail: 'Este correo ya está en uso por otro administrador.' }, { status: 400 });
        }
        updateData.email = cleanEmail;
      }
    }

    if (role && !isTargetProtected) {
      const cleanRole = role.trim();
      if (!VALID_ADMIN_ROLES.includes(cleanRole)) {
        return NextResponse.json({ detail: `Rol inválido. Roles permitidos: ${VALID_ADMIN_ROLES.join(', ')}` }, { status: 400 });
      }
      updateData.role = cleanRole;
    }

    if (password && password.trim()) {
      updateData.password_hash = hashPassword(password.trim());
    }

    const updated = await prisma.admin.update({
      where: { id: adminId },
      data: updateData,
    });

    return NextResponse.json({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
    });
  } catch (error: any) {
    console.error('❌ Error al actualizar admin:', error);
    return NextResponse.json({ detail: `Error al actualizar administrador: ${error?.message || 'Error desconocido'}` }, { status: 500 });
  }
}

// DELETE /api/admin/admins/[id] - Eliminar administrador
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const currentAdmin = await getCurrentAdmin(req);
  if (!currentAdmin) {
    return NextResponse.json({ detail: 'No autorizado.' }, { status: 401 });
  }

  if (!isSuperAdmin(currentAdmin)) {
    return NextResponse.json({ detail: 'Solo el Super Administrador puede eliminar administradores.' }, { status: 403 });
  }

  try {
    const adminId = parseInt(params.id);
    if (isNaN(adminId)) {
      return NextResponse.json({ detail: 'ID de administrador inválido.' }, { status: 400 });
    }

    if (currentAdmin.id === adminId) {
      return NextResponse.json({ detail: 'No puedes eliminar tu propia cuenta.' }, { status: 400 });
    }

    const targetAdmin = await prisma.admin.findUnique({ where: { id: adminId } });
    if (!targetAdmin) {
      return NextResponse.json({ detail: 'Administrador no encontrado.' }, { status: 404 });
    }

    if (targetAdmin.email.toLowerCase() === PROTECTED_SUPER_ADMIN_EMAIL) {
      return NextResponse.json({ detail: 'No se puede eliminar la cuenta principal del sistema.' }, { status: 403 });
    }

    await prisma.admin.delete({ where: { id: adminId } });
    return NextResponse.json({ status: 'deleted', message: 'Administrador eliminado con éxito.' });
  } catch (error: any) {
    console.error('❌ Error al eliminar admin:', error);
    return NextResponse.json({ detail: `Error al eliminar administrador: ${error?.message || 'Error desconocido'}` }, { status: 500 });
  }
}
