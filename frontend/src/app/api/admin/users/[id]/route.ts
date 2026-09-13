import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// DELETE /api/admin/users/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    const customerId = parseInt(params.id);
    await prisma.customer.delete({ where: { id: customerId } });
    return NextResponse.json({ status: 'deleted' });
  } catch (error: any) {
    return NextResponse.json({ detail: 'Error eliminando cliente' }, { status: 500 });
  }
}
