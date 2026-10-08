import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth';

async function generateBatchNumber(): Promise<string> {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const prefix = `LOTE-${yyyy}${mm}${dd}-`;

  const last = await prisma.purchaseBatch.findFirst({
    where: {
      batch_number: {
        startsWith: prefix,
      },
    },
    orderBy: {
      batch_number: 'desc',
    },
  });

  let seq = 1;
  if (last?.batch_number) {
    const parts = last.batch_number.split('-');
    const num = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(num)) {
      seq = num + 1;
    }
  }
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

// GET /api/admin/purchase-batches - listar lotes
export async function GET(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
  const skip = Math.max(0, parseInt(searchParams.get('skip') || '0', 10));

  try {
    const [total, batches] = await Promise.all([
      prisma.purchaseBatch.count(),
      prisma.purchaseBatch.findMany({
        take: limit,
        skip,
        orderBy: [{ purchase_date: 'desc' }, { id: 'desc' }],
        include: {
          supplier: true,
          items: true,
        },
      }),
    ]);

    const result = batches.map(b => ({
      id: b.id,
      batch_number: b.batch_number,
      supplier_id: b.supplier_id,
      supplier_name: b.supplier?.name || null,
      purchase_date: b.purchase_date ? b.purchase_date.toISOString() : null,
      currency: b.currency,
      exchange_rate: b.exchange_rate,
      shipping_currency: b.shipping_currency,
      shipping_cost_original: b.shipping_cost_original,
      shipping_cost_ars: b.shipping_cost_ars,
      total_products_ars: b.total_products_ars,
      total_cost_ars: b.total_cost_ars,
      notes: b.notes,
      created_at: b.created_at ? b.created_at.toISOString() : null,
      items_count: b.items.length,
      items: b.items.map(it => ({
        id: it.id,
        batch_id: it.batch_id,
        product_id: it.product_id,
        variant_id: it.variant_id,
        product_name: it.product_name,
        variant_label: it.variant_label,
        quantity: it.quantity,
        unit_cost_original: it.unit_cost_original,
        unit_cost_ars: it.unit_cost_ars,
        shipping_per_unit_ars: it.shipping_per_unit_ars,
        total_cost_per_unit_ars: it.total_cost_per_unit_ars,
      })),
    }));

    return NextResponse.json({ total, batches: result });
  } catch (error: any) {
    return NextResponse.json({ detail: 'Error al listar lotes: ' + error.message }, { status: 500 });
  }
}

// POST /api/admin/purchase-batches - crear lote con items
export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json();

    // 1. Resolver o crear proveedor
    let supplierId: number | null = null;
    if (body.supplier_name && body.supplier_name.trim()) {
      const name = body.supplier_name.trim();
      let sup = await prisma.supplier.findUnique({ where: { name } });
      if (!sup) {
        sup = await prisma.supplier.create({ data: { name } });
      }
      supplierId = sup.id;
    }

    // 2. Generar número de lote
    const batchNumber = await generateBatchNumber();

    // 3. Parsear fecha
    let purchaseDate = new Date();
    if (body.purchase_date) {
      const parsed = new Date(body.purchase_date);
      if (!isNaN(parsed.getTime())) {
        purchaseDate = parsed;
      }
    }

    // 4. Crear lote con items en transacción
    const batch = await prisma.purchaseBatch.create({
      data: {
        batch_number: batchNumber,
        supplier_id: supplierId,
        purchase_date: purchaseDate,
        currency: body.currency || 'ARS',
        exchange_rate: Number(body.exchange_rate) || 1.0,
        shipping_currency: body.shipping_currency || 'ARS',
        shipping_cost_original: Number(body.shipping_cost_original) || 0.0,
        shipping_cost_ars: Number(body.shipping_cost_ars) || 0.0,
        total_products_ars: Number(body.total_products_ars) || 0.0,
        total_cost_ars: Number(body.total_cost_ars) || 0.0,
        notes: body.notes || null,
        items: {
          create: (body.items || []).map((it: any) => ({
            product_id: String(it.product_id),
            variant_id: String(it.variant_id),
            product_name: it.product_name || null,
            variant_label: it.variant_label || null,
            quantity: Number(it.quantity) || 1,
            unit_cost_original: Number(it.unit_cost_original) || 0.0,
            unit_cost_ars: Number(it.unit_cost_ars) || 0.0,
            shipping_per_unit_ars: Number(it.shipping_per_unit_ars) || 0.0,
            total_cost_per_unit_ars: Number(it.total_cost_per_unit_ars) || 0.0,
            sale_price: Number(it.sale_price) || 0.0,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json({
      id: batch.id,
      batch_number: batch.batch_number,
      supplier_id: batch.supplier_id,
      supplier_name: body.supplier_name || null,
      total_cost_ars: batch.total_cost_ars,
      items_count: batch.items.length,
    });
  } catch (error: any) {
    return NextResponse.json({ detail: 'Error al registrar lote: ' + error.message }, { status: 500 });
  }
}
