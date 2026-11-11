export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth';

// DELETE /api/orders/admin/[orderNumber]
export async function DELETE(req: NextRequest, { params }: { params: { orderNumber: string } }) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
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

// PUT /api/orders/admin/[orderNumber]
// Permite modificar productos (agregar, eliminar, cambiar precio o cantidad) y método/costo de envío
export async function PUT(req: NextRequest, { params }: { params: { orderNumber: string } }) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    const { orderNumber } = params;
    const body = await req.json();

    const order = await prisma.order.findUnique({
      where: { order_number: orderNumber },
      include: { customer: true, items: true },
    });

    if (!order) {
      return NextResponse.json({ detail: 'Pedido no encontrado' }, { status: 404 });
    }

    const { items, shipping_type, shipping_cost, admin_notes } = body;

    if (items !== undefined && (!Array.isArray(items) || items.length === 0)) {
      return NextResponse.json({ detail: 'El pedido debe tener al menos un producto' }, { status: 400 });
    }

    let calculatedTotal = Number(order.total || 0);

    const updated = await prisma.$transaction(async (tx) => {
      if (Array.isArray(items)) {
        await tx.orderItem.deleteMany({
          where: { order_id: order.id },
        });

        await tx.orderItem.createMany({
          data: items.map((it: any) => ({
            order_id: order.id,
            product_id: String(it.product_id || ''),
            variant_id: String(it.variant_id || ''),
            product_name: it.product_name || 'Producto',
            variant_info: it.variant_info || '',
            image_url: it.image_url || null,
            quantity: Math.max(1, Number(it.quantity) || 1),
            price: Math.max(0, Number(it.price) || 0),
          })),
        });

        const itemsSum = items.reduce((sum: number, it: any) => {
          return sum + (Math.max(1, Number(it.quantity) || 1) * Math.max(0, Number(it.price) || 0));
        }, 0);

        const effShippingType = shipping_type !== undefined ? shipping_type : (order.shipping_type || 'delivery');
        const effShippingCost = effShippingType === 'pickup'
          ? 0
          : (shipping_cost !== undefined ? Math.max(0, Number(shipping_cost)) : Number(order.shipping_cost || 0));

        calculatedTotal = itemsSum + effShippingCost;
      } else if (shipping_type !== undefined || shipping_cost !== undefined) {
        const itemsSum = order.items.reduce((sum, it) => sum + ((it.quantity || 1) * (it.price || 0)), 0);
        const effShippingType = shipping_type !== undefined ? shipping_type : (order.shipping_type || 'delivery');
        const effShippingCost = effShippingType === 'pickup'
          ? 0
          : (shipping_cost !== undefined ? Math.max(0, Number(shipping_cost)) : Number(order.shipping_cost || 0));

        calculatedTotal = itemsSum + effShippingCost;
      }

      const orderData: any = {};
      if (items !== undefined || shipping_type !== undefined || shipping_cost !== undefined) {
        orderData.total = calculatedTotal;
      }
      if (shipping_type !== undefined) {
        orderData.shipping_type = shipping_type;
        if (shipping_type === 'pickup') orderData.shipping_cost = 0;
      }
      if (shipping_cost !== undefined && shipping_type !== 'pickup') {
        orderData.shipping_cost = Math.max(0, Number(shipping_cost));
      }
      if (admin_notes !== undefined) {
        orderData.admin_notes = admin_notes;
      }
      if (body.paid_amount !== undefined) {
        orderData.paid_amount = Number(body.paid_amount);
      }
      if (body.payment_status !== undefined) {
        orderData.payment_status = body.payment_status;
      }

      return tx.order.update({
        where: { id: order.id },
        data: orderData,
        include: { customer: true, items: true },
      });
    });

    return NextResponse.json({
      status: 'ok',
      message: 'Pedido actualizado correctamente',
      order: {
        ...updated,
        total: Number(updated.total || 0),
        shipping_cost: Number(updated.shipping_cost || 0),
        items: updated.items.map(i => ({
          ...i,
          price: Number(i.price || 0),
        })),
      },
    });
  } catch (error: any) {
    console.error('Error updating order by admin:', error);
    return NextResponse.json({ detail: error.message || 'Error al actualizar pedido' }, { status: 500 });
  }
}
