import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer } from '@/lib/auth';

// POST /api/orders - create order (customer)
export async function POST(req: NextRequest) {
  const customer = await getCurrentCustomer(req);
  if (!customer) return NextResponse.json({ detail: 'No autenticado' }, { status: 401 });
  if (!customer.is_approved) {
    return NextResponse.json({ detail: 'Tu cuenta está pendiente de aprobación por un administrador para poder realizar compras.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { order_number, items, shipping_type, shipping_cost } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ detail: 'El carrito está vacío.' }, { status: 400 });
    }

    const parsedItems = items.map((i: any) => {
      const pid = i.product_id || i.productId;
      const vid = i.variant_id || i.variantId;
      if (!pid || !vid) throw new Error('Faltan datos del producto o variante');
      return {
        product_id: pid,
        variant_id: vid,
        product_name: i.product_name || i.productName || 'Producto',
        variant_info: i.variant_info || i.variantInfo || '',
        image_url: i.image_url || i.imageUrl || '',
        quantity: i.quantity || 1,
        price: i.sale_price ?? i.salePrice ?? 0,
      };
    });

    const itemsTotal = parsedItems.reduce((acc: number, i: any) => acc + i.quantity * i.price, 0);
    const validatedShippingCost = shipping_type === 'pickup' ? 0 : Math.max(0, Number(shipping_cost || 0));
    const total = itemsTotal + validatedShippingCost;
    const orderNumber = order_number || ('ORD-' + Math.random().toString(36).substring(2, 10).toUpperCase());

    const newOrder = await prisma.order.create({
      data: {
        user_id: customer.id,
        order_number: orderNumber,
        status: 'En revisión',
        payment_status: 'pending',
        delivery_status: 'pending',
        shipping_type: shipping_type || 'delivery',
        shipping_cost: validatedShippingCost,
        paid_amount: 0,
        total,
        created_at: new Date(),
        items: {
          create: parsedItems,
        },
      },
    });

    return NextResponse.json({ status: 'ok', order_number: orderNumber });
  } catch (error: any) {
    console.error('Create order error:', error);
    return NextResponse.json({ detail: error.message || 'Error creando pedido' }, { status: 500 });
  }
}

// GET /api/orders - list current customer's orders
export async function GET(req: NextRequest) {
  const customer = await getCurrentCustomer(req);
  if (!customer) return NextResponse.json({ detail: 'No autenticado' }, { status: 401 });

  const orders = await prisma.order.findMany({
    where: { user_id: customer.id },
    include: { items: true },
    orderBy: { created_at: 'desc' },
  });

  return NextResponse.json(orders.map(o => {
    const tot = Number(o.total || 0);
    const paid = Number(o.paid_amount || 0);
    return {
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
      remaining_amount: Math.max(0, tot - paid),
      admin_notes: o.admin_notes,
      created_at: o.created_at,
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
  }));
}
