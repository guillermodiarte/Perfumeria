import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth';

// GET /api/orders/admin/all
export async function GET(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    const orders = await prisma.order.findMany({
      include: {
        customer: true,
        items: true,
      },
      orderBy: { created_at: 'desc' },
    });

    const res = orders.map(o => {
      const cust = o.customer;
      const tot = Number(o.total || 0);
      const paid = Number(o.paid_amount || 0);
      const remaining = Math.max(0, tot - paid);

      return {
        id: o.id,
        order_number: o.order_number,
        status: o.status || 'En revisión',
        payment_status: o.payment_status || 'pending',
        payment_type: o.payment_type || 'total',
        installments_count: o.installments_count || 1,
        last_installment_paid_month: o.last_installment_paid_month,
        delivery_status: o.delivery_status || 'pending',
        shipping_type: o.shipping_type || 'delivery',
        shipping_cost: Number(o.shipping_cost || 0),
        shipping_tracking_number: o.shipping_tracking_number,
        shipping_invoice_url: o.shipping_invoice_url,
        shipped_at: o.shipped_at,
        total: tot,
        paid_amount: paid,
        remaining_amount: remaining,
        admin_notes: o.admin_notes,
        created_at: o.created_at,
        customer: {
          id: cust?.id ?? null,
          name: cust?.name ?? 'Cliente',
          email: cust?.email ?? '',
          phone: cust?.phone ?? '',
          address: cust?.address ?? '',
          province: cust?.province ?? '',
          city: cust?.city ?? '',
          postal_code: cust?.postal_code ?? '',
          is_wholesale: cust?.is_wholesale ?? false,
          wholesale_until: cust?.wholesale_until ?? null,
        },
        items: o.items.map(i => ({
          product_id: i.product_id,
          variant_id: i.variant_id,
          product_name: i.product_name,
          variant_info: i.variant_info,
          image_url: i.image_url,
          quantity: i.quantity,
          price: Number(i.price || 0),
        })),
      };
    });

    return NextResponse.json(res);
  } catch (error: any) {
    console.error('Error fetching admin orders:', error);
    return NextResponse.json({ detail: error.message || 'Error al obtener pedidos' }, { status: 500 });
  }
}
