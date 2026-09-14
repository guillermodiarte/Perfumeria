import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureDbSchema } from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth';

// DELETE /api/orders/admin/[orderNumber]
export async function DELETE(req: NextRequest, { params }: { params: { orderNumber: string } }) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    await ensureDbSchema();
    const { orderNumber } = params;

    const order = await prisma.order.findUnique({
      where: { order_number: orderNumber },
      include: { items: true },
    });

    if (!order) {
      return NextResponse.json({ detail: 'Pedido no encontrado' }, { status: 404 });
    }

    const itemsData = order.items.map(i => ({
      product_id: i.product_id,
      variant_id: i.variant_id,
      quantity: i.quantity,
    }));

    // Cascade deletion of items will be handled or delete items first
    await prisma.orderItem.deleteMany({
      where: { order_id: order.id },
    });

    await prisma.order.delete({
      where: { id: order.id },
    });

    return NextResponse.json({
      status: 'ok',
      message: 'Pedido eliminado por administrador',
      order_number: orderNumber,
      restored_items: itemsData,
    });
  } catch (error: any) {
    console.error('Error deleting order by admin:', error);
    return NextResponse.json({ detail: error.message || 'Error al eliminar pedido' }, { status: 500 });
  }
}
