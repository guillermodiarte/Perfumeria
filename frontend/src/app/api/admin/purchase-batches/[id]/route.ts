import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth';

// GET /api/admin/purchase-batches/[id] - detalle de un lote
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ detail: 'ID de lote inválido' }, { status: 400 });
  }

  try {
    const batch = await prisma.purchaseBatch.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: true,
      },
    });

    if (!batch) {
      return NextResponse.json({ detail: 'Lote no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      id: batch.id,
      batch_number: batch.batch_number,
      supplier_id: batch.supplier_id,
      supplier_name: batch.supplier?.name || null,
      purchase_date: batch.purchase_date ? batch.purchase_date.toISOString() : null,
      currency: batch.currency,
      exchange_rate: batch.exchange_rate,
      shipping_currency: batch.shipping_currency,
      shipping_cost_original: batch.shipping_cost_original,
      shipping_cost_ars: batch.shipping_cost_ars,
      total_products_ars: batch.total_products_ars,
      total_cost_ars: batch.total_cost_ars,
      notes: batch.notes,
      created_at: batch.created_at ? batch.created_at.toISOString() : null,
      items: batch.items.map(it => ({
        id: it.id,
        product_id: it.product_id,
        variant_id: it.variant_id,
        product_name: it.product_name,
        variant_label: it.variant_label,
        quantity: it.quantity,
        unit_cost_original: it.unit_cost_original,
        unit_cost_ars: it.unit_cost_ars,
        shipping_per_unit_ars: it.shipping_per_unit_ars,
        total_cost_per_unit_ars: it.total_cost_per_unit_ars,
        sale_price: it.sale_price,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ detail: 'Error al consultar lote: ' + error.message }, { status: 500 });
  }
}
