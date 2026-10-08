export const dynamic = 'force-dynamic';
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

// PUT /api/admin/purchase-batches/[id] - editar datos de un lote y sus items
export async function PUT(
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
    const body = await req.json();

    const existing = await prisma.purchaseBatch.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) {
      return NextResponse.json({ detail: 'Lote no encontrado' }, { status: 404 });
    }

    // 1. Resolver proveedor si cambió
    let supplierId = existing.supplier_id;
    if (body.supplier_name !== undefined) {
      const name = (body.supplier_name || '').trim();
      if (name) {
        let sup = await prisma.supplier.findUnique({ where: { name } });
        if (!sup) {
          sup = await prisma.supplier.create({ data: { name } });
        }
        supplierId = sup.id;
      } else {
        supplierId = null;
      }
    }

    // 2. Parsear fecha
    let purchaseDate = existing.purchase_date;
    if (body.purchase_date) {
      const parsed = new Date(body.purchase_date);
      if (!isNaN(parsed.getTime())) purchaseDate = parsed;
    }

    // 3. Actualizar items si se proporcionaron
    if (Array.isArray(body.items)) {
      for (const it of body.items) {
        if (it.id) {
          await prisma.purchaseBatchItem.update({
            where: { id: it.id },
            data: {
              quantity: it.quantity !== undefined ? Number(it.quantity) : undefined,
              sale_price: it.sale_price !== undefined ? Number(it.sale_price) : undefined,
              unit_cost_ars: it.unit_cost_ars !== undefined ? Number(it.unit_cost_ars) : undefined,
              shipping_per_unit_ars: it.shipping_per_unit_ars !== undefined ? Number(it.shipping_per_unit_ars) : undefined,
              total_cost_per_unit_ars: it.total_cost_per_unit_ars !== undefined ? Number(it.total_cost_per_unit_ars) : undefined,
            },
          });
        }
      }
    }

    // 4. Recalcular totales
    const updatedItems = await prisma.purchaseBatchItem.findMany({
      where: { batch_id: id },
    });

    const totalProductsARS = updatedItems.reduce(
      (sum, it) => sum + (it.unit_cost_ars || 0) * (it.quantity || 1),
      0
    );
    const shippingCostARS = body.shipping_cost_ars !== undefined ? Number(body.shipping_cost_ars) : (existing.shipping_cost_ars || 0);
    const totalCostARS = totalProductsARS + shippingCostARS;

    const updatedBatch = await prisma.purchaseBatch.update({
      where: { id },
      data: {
        supplier_id: supplierId,
        purchase_date: purchaseDate,
        notes: body.notes !== undefined ? body.notes : existing.notes,
        shipping_cost_ars: shippingCostARS,
        total_products_ars: totalProductsARS,
        total_cost_ars: totalCostARS,
      },
      include: {
        supplier: true,
        items: true,
      },
    });

    return NextResponse.json({
      id: updatedBatch.id,
      batch_number: updatedBatch.batch_number,
      supplier_id: updatedBatch.supplier_id,
      supplier_name: updatedBatch.supplier?.name || null,
      purchase_date: updatedBatch.purchase_date ? updatedBatch.purchase_date.toISOString() : null,
      currency: updatedBatch.currency,
      exchange_rate: updatedBatch.exchange_rate,
      shipping_cost_ars: updatedBatch.shipping_cost_ars,
      total_products_ars: updatedBatch.total_products_ars,
      total_cost_ars: updatedBatch.total_cost_ars,
      notes: updatedBatch.notes,
      items: updatedBatch.items,
    });
  } catch (error: any) {
    return NextResponse.json({ detail: 'Error al actualizar lote: ' + error.message }, { status: 500 });
  }
}

// DELETE /api/admin/purchase-batches/[id] - eliminar lote y devolver items para descontar stock
export async function DELETE(
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
      include: { items: true },
    });

    if (!batch) {
      return NextResponse.json({ detail: 'Lote no encontrado' }, { status: 404 });
    }

    // Eliminar batch (los items se eliminan en cascada por onDelete: Cascade en el schema)
    await prisma.purchaseBatch.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      deleted_batch_number: batch.batch_number,
      items: batch.items.map(it => ({
        product_id: it.product_id,
        variant_id: it.variant_id,
        product_name: it.product_name,
        variant_label: it.variant_label,
        quantity: it.quantity,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ detail: 'Error al eliminar lote: ' + error.message }, { status: 500 });
  }
}
