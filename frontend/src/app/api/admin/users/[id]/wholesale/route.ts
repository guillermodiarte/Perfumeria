import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// PATCH /api/admin/users/[id]/wholesale
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const customerId = parseInt(params.id);
    const { is_wholesale, wholesale_until } = body;

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return NextResponse.json({ detail: 'Cliente no encontrado' }, { status: 404 });

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: {
        ...(is_wholesale !== undefined && { is_wholesale }),
        ...(wholesale_until !== undefined && { wholesale_until: wholesale_until ? new Date(wholesale_until) : null }),
      },
    });

    return NextResponse.json({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      is_wholesale: updated.is_wholesale,
      wholesale_until: updated.wholesale_until,
    });
  } catch (error: any) {
    return NextResponse.json({ detail: 'Error actualizando mayorista' }, { status: 500 });
  }
}
