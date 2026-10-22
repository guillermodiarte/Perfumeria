export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentAdmin, isSuperAdmin } from '@/lib/auth';

function canManageExpenses(admin: any): boolean {
  if (!admin) return false;
  return isSuperAdmin(admin) || admin.role === 'admin';
}

// PUT /api/admin/expenses/[id]
// Modifica un gasto existente
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getCurrentAdmin(req);
  if (!admin) {
    return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });
  }
  if (!canManageExpenses(admin)) {
    return NextResponse.json({ detail: 'Acceso denegado: solo Administradores pueden editar gastos' }, { status: 403 });
  }

  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ detail: 'ID inválido' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const category = (body.category || 'servicios').trim();
    const date = (body.date || new Date().toISOString().slice(0, 10)).trim();
    const title = (body.title || '').trim();
    const description = (body.description || '').trim();
    const quantity = Number(body.quantity) || 1;
    const unit_price = Number(body.unit_price) || 0;
    let amount = Number(body.amount);

    if (isNaN(amount) || amount <= 0) {
      if (quantity > 0 && unit_price > 0) {
        amount = quantity * unit_price;
      } else {
        amount = 0;
      }
    }

    if (!title) {
      return NextResponse.json({ detail: 'El detalle / concepto es requerido' }, { status: 400 });
    }
    if (amount <= 0) {
      return NextResponse.json({ detail: 'El monto total debe ser mayor a 0' }, { status: 400 });
    }

    const payment_method = (body.payment_method || '').trim();

    await prisma.$executeRawUnsafe(
      `UPDATE "expenses"
       SET "category" = ?, "date" = ?, "title" = ?, "description" = ?, "quantity" = ?, "unit_price" = ?, "amount" = ?, "payment_method" = ?
       WHERE "id" = ?`,
      category,
      date,
      title,
      description || null,
      quantity,
      unit_price,
      amount,
      payment_method || null,
      id
    );

    const updated: any = await prisma.$queryRawUnsafe(
      `SELECT * FROM "expenses" WHERE "id" = ?`,
      id
    );

    return NextResponse.json(updated && updated[0] ? updated[0] : { success: true });
  } catch (error: any) {
    console.error('Error al actualizar gasto:', error);
    return NextResponse.json({ detail: 'Error al actualizar gasto' }, { status: 500 });
  }
}

// DELETE /api/admin/expenses/[id]
// Elimina un gasto existente
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getCurrentAdmin(req);
  if (!admin) {
    return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });
  }
  if (!canManageExpenses(admin)) {
    return NextResponse.json({ detail: 'Acceso denegado: solo Administradores pueden eliminar gastos' }, { status: 403 });
  }

  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ detail: 'ID inválido' }, { status: 400 });
  }

  try {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "expenses" WHERE "id" = ?`,
      id
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al eliminar gasto:', error);
    return NextResponse.json({ detail: 'Error al eliminar gasto' }, { status: 500 });
  }
}
