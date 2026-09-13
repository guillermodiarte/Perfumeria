import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// PATCH /api/admin/users/[id]/approval
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const customerId = parseInt(params.id);
    const { is_approved } = body;

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: { is_approved: Boolean(is_approved) },
    });

    return NextResponse.json({ id: updated.id, email: updated.email, is_approved: updated.is_approved });
  } catch (error: any) {
    return NextResponse.json({ detail: 'Error actualizando aprobación' }, { status: 500 });
  }
}
