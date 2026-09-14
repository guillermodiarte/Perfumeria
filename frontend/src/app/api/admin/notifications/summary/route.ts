import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureDbSchema } from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth';

// GET /api/admin/notifications/summary
export async function GET(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    await ensureDbSchema();
    const now = new Date();
    const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    // Pending web orders
    const pendingOrders = await prisma.order.findMany({
      where: { status: 'En revisión' },
      include: { customer: true },
    });
    const pendingOrdersCount = pendingOrders.length;

    // Orders with debt
    const ordersWithDebt = await prisma.order.findMany({
      where: {
        NOT: { status: 'Rechazada' },
        OR: [
          { payment_status: 'pending' },
          { payment_status: 'partial' },
          { payment_type: 'cuotas' },
        ],
      },
      include: { customer: true },
    });

    const installmentsPending: any[] = [];
    for (const o of ordersWithDebt) {
      const tot = Number(o.total || 0);
      const paid = Number(o.paid_amount || 0);
      const rem = Math.max(0, tot - paid);
      if (rem > 0 && o.last_installment_paid_month !== currentMonth) {
        installmentsPending.push({
          order_number: o.order_number,
          customer_name: o.customer?.name || 'Cliente',
          remaining_amount: rem,
          payment_type: o.payment_type || 'cuotas',
          installments_count: o.installments_count || 1,
        });
      }
    }

    // Pending customers
    const pendingCustomersCount = await prisma.customer.count({ where: { is_approved: false } });

    const totalBadge = pendingOrdersCount + installmentsPending.length;

    return NextResponse.json({
      pending_web_orders_count: pendingOrdersCount,
      installments_pending_this_month: installmentsPending,
      installments_pending_count: installmentsPending.length,
      pending_customers_count: pendingCustomersCount,
      total_notifications_count: totalBadge,
      current_month: currentMonth,
    });
  } catch (error) {
    console.error('Notifications summary error:', error);
    return NextResponse.json({ detail: 'Error obteniendo notificaciones' }, { status: 500 });
  }
}
