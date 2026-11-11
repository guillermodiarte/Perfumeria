export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth';

// PATCH /api/orders/admin/[orderNumber]/status
export async function PATCH(req: NextRequest, { params }: { params: { orderNumber: string } }) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    const { orderNumber } = params;
    const body = await req.json();

    const order = await prisma.order.findUnique({
      where: { order_number: orderNumber },
      include: {
        customer: true,
        items: true,
      },
    });

    if (!order) {
      return NextResponse.json({ detail: 'Pedido no encontrado' }, { status: 404 });
    }

    const wasAlreadyApproved = (order.status || '').toLowerCase().startsWith('aprob');

    const updateData: any = {};
    if (body.status !== undefined) {
      updateData.status = body.status;
      const sNorm = String(body.status).toLowerCase();
      if ((sNorm.includes('rechaz') || sNorm.includes('cancel')) && body.delivery_status === undefined) {
        updateData.delivery_status = 'cancelled';
      }
    }
    if (body.payment_status !== undefined) updateData.payment_status = body.payment_status;
    if (body.payment_type !== undefined) updateData.payment_type = body.payment_type;
    if (body.installments_count !== undefined) updateData.installments_count = body.installments_count;
    if (body.last_installment_paid_month !== undefined) updateData.last_installment_paid_month = body.last_installment_paid_month;
    if (body.delivery_status !== undefined) updateData.delivery_status = body.delivery_status;
    if (body.paid_amount !== undefined) updateData.paid_amount = Number(body.paid_amount);
    if (body.admin_notes !== undefined) updateData.admin_notes = body.admin_notes;
    if (body.shipping_type !== undefined) updateData.shipping_type = body.shipping_type;
    if (body.shipping_cost !== undefined) updateData.shipping_cost = Number(body.shipping_cost);
    if (body.shipping_tracking_number !== undefined) updateData.shipping_tracking_number = body.shipping_tracking_number;
    if (body.shipping_invoice_url !== undefined) updateData.shipping_invoice_url = body.shipping_invoice_url;
    if (body.shipped_at !== undefined) updateData.shipped_at = body.shipped_at;

    // Si se enviaron items modificados (ej: descuentos especiales para Mayoristas Especiales)
    if (Array.isArray(body.items) && body.items.length > 0) {
      await prisma.orderItem.deleteMany({
        where: { order_id: order.id },
      });
      await prisma.orderItem.createMany({
        data: body.items.map((it: any) => ({
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

      const itemsSum = body.items.reduce((sum: number, it: any) => {
        return sum + (Math.max(1, Number(it.quantity) || 1) * Math.max(0, Number(it.price) || 0));
      }, 0);

      const effShippingType = body.shipping_type !== undefined ? body.shipping_type : (order.shipping_type || 'delivery');
      const effShippingCost = effShippingType === 'pickup'
        ? 0
        : (body.shipping_cost !== undefined ? Math.max(0, Number(body.shipping_cost)) : Number(order.shipping_cost || 0));

      updateData.total = itemsSum + effShippingCost;

      if (body.payment_type === 'total' || (order.payment_type === 'total' && body.paid_amount === undefined)) {
        updateData.paid_amount = updateData.total;
      }
    }

    // Check if status is changed to approved
    const nowApproved = (body.status || order.status || '').toLowerCase().startsWith('aprob');
    if (nowApproved && !wasAlreadyApproved && order.customer) {
      // Check wholesale auto membership setting
      const setting = await prisma.siteSetting.findUnique({
        where: { key: 'wholesale_auto_enabled' },
      });

      let autoEnabled = false;
      let minQty = 6;
      if (setting?.value) {
        try {
          const parsed = JSON.parse(setting.value);
          if (typeof parsed === 'object' && parsed !== null) {
            autoEnabled = !!parsed.enabled;
            minQty = Number(parsed.min_quantity || 6);
          } else if (typeof parsed === 'boolean') {
            autoEnabled = parsed;
          }
        } catch {
          // ignore json parse error
        }
      }

      if (autoEnabled) {
        const totalItems = order.items.reduce((acc, item) => acc + (item.quantity || 0), 0);
        if (totalItems >= minQty) {
          const newUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          await prisma.customer.update({
            where: { id: order.customer.id },
            data: { wholesale_until: newUntil },
          });
        }
      }
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: updateData,
    });

    const tot = Number(updated.total || 0);
    const paid = Number(updated.paid_amount || 0);

    return NextResponse.json({
      status: 'ok',
      order_number: updated.order_number,
      order_status: updated.status,
      payment_status: updated.payment_status,
      payment_type: updated.payment_type,
      installments_count: updated.installments_count,
      last_installment_paid_month: updated.last_installment_paid_month,
      delivery_status: updated.delivery_status,
      paid_amount: paid,
      remaining_amount: Math.max(0, tot - paid),
    });
  } catch (error: any) {
    console.error('Error updating order status:', error);
    return NextResponse.json({ detail: error.message || 'Error al actualizar pedido' }, { status: 500 });
  }
}
