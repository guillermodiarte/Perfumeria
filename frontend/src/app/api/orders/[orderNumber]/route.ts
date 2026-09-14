import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureDbSchema } from '@/lib/prisma';
import { getCurrentCustomer } from '@/lib/auth';

// DELETE /api/orders/[orderNumber]
export async function DELETE(req: NextRequest, { params }: { params: { orderNumber: string } }) {
  const customer = await getCurrentCustomer(req);
  if (!customer) return NextResponse.json({ detail: 'No autenticado' }, { status: 401 });

  try {
    await ensureDbSchema();
    const { orderNumber } = params;

    const order = await prisma.order.findUnique({
      where: { order_number: orderNumber },
      include: { items: true },
    });

    if (!order || order.user_id !== customer.id) {
      return NextResponse.json({ detail: 'Pedido no encontrado' }, { status: 404 });
    }

    const s = (order.status || '').toLowerCase();
    const p = (order.payment_status || '').toLowerCase();
    const d = (order.delivery_status || '').toLowerCase();
    if (
      s.includes('aprob') ||
      s.includes('entreg') ||
      d.includes('entreg') ||
      p === 'full' ||
      p === 'partial' ||
      Number(order.paid_amount || 0) > 0
    ) {
      return NextResponse.json(
        { detail: 'No podés eliminar un pedido que ya fue aceptado o pagado.' },
        { status: 400 }
      );
    }

    const itemsData = order.items.map(i => ({
      product_id: i.product_id,
      variant_id: i.variant_id,
      quantity: i.quantity,
    }));

    await prisma.orderItem.deleteMany({
      where: { order_id: order.id },
    });

    await prisma.order.delete({
      where: { id: order.id },
    });

    return NextResponse.json({
      status: 'ok',
      message: 'Pedido eliminado correctamente',
      order_number: orderNumber,
      restored_items: itemsData,
    });
  } catch (error: any) {
    console.error('Error canceling order:', error);
    return NextResponse.json({ detail: error.message || 'Error al eliminar pedido' }, { status: 500 });
  }
}
