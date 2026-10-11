import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function cleanName(n: string) {
  return (n || '')
    .toLowerCase()
    .replace(/edp|edt|eau de parfum|eau de toilette|\b\d+\s*ml\b|\b\d+\s*g\b/gi, '')
    .replace(/[^\w\sáéíóúüñ]/gi, ' ')
    .replace(/y/g, 'i')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * PATCH /api/admin/products/[productId]/rename
 * Actualiza el nombre de un producto en cascada en todas las tablas relacionadas de la BD:
 * - purchase_batch_items (lotes de compra)
 * - order_items (pedidos)
 * - catalog_store_data (catálogo, historial de compras y ventas)
 *
 * Body: { newName: string, oldName?: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const { productId } = params;
    const body = await req.json();
    const newName = (body?.newName || '').trim();
    const oldName = (body?.oldName || '').trim();

    if (!productId || !newName) {
      return NextResponse.json(
        { error: 'productId y newName son requeridos' },
        { status: 400 }
      );
    }

    let batchItemsUpdated = 0;

    // 1. Actualizar por product_id directo
    const resDirect = await prisma.purchaseBatchItem.updateMany({
      where: { product_id: productId },
      data: { product_name: newName },
    });
    batchItemsUpdated += resDirect.count;

    // 2. Si se proporcionó oldName, actualizar por nombre antiguo y enlazar product_id
    if (oldName && oldName.toLowerCase() !== newName.toLowerCase()) {
      const resOld = await prisma.purchaseBatchItem.updateMany({
        where: { product_name: oldName },
        data: {
          product_name: newName,
          product_id: productId,
        },
      });
      batchItemsUpdated += resOld.count;
    }

    // 3. Buscar en catalog_store_data para localizar lotes asociados
    let setting: any = null;
    try {
      setting = await prisma.siteSetting.findUnique({
        where: { key: 'catalog_store_data' },
      });
    } catch {}

    if (setting?.value) {
      try {
        const parsed = JSON.parse(setting.value as string);

        // Buscar batches donde este producto tenga compras registradas
        const relatedBatchIds = new Set<string>();
        if (Array.isArray(parsed.purchases)) {
          parsed.purchases.forEach((p: any) => {
            if (p.productId === productId || (oldName && p.productName?.toLowerCase() === oldName.toLowerCase())) {
              if (p.batchId) relatedBatchIds.add(p.batchId);
            }
          });
        }

        // Si hay lotes relacionados, actualizar sus items que coincidan
        if (relatedBatchIds.size > 0) {
          const batches = await prisma.purchaseBatch.findMany({
            where: { batch_number: { in: Array.from(relatedBatchIds) } },
            include: { items: true },
          });

          const cNew = cleanName(newName);
          const cOld = cleanName(oldName);

          for (const b of batches) {
            for (const it of b.items) {
              if (it.product_id === productId) continue; // ya actualizado

              const itClean = cleanName(it.product_name || '');
              const matchesOld = cOld && (itClean === cOld || itClean.includes(cOld) || cOld.includes(itClean));
              const matchesNew = cNew && (itClean === cNew || itClean.includes(cNew) || cNew.includes(itClean));

              if (matchesOld || matchesNew) {
                await prisma.purchaseBatchItem.update({
                  where: { id: it.id },
                  data: {
                    product_name: newName,
                    product_id: productId,
                  },
                });
                batchItemsUpdated++;
              }
            }
          }
        }

        // Actualizar catalog_store_data en memoria
        if (Array.isArray(parsed.products)) {
          parsed.products = parsed.products.map((p: any) =>
            p.id === productId ? { ...p, name: newName } : p
          );
        }

        if (Array.isArray(parsed.purchases)) {
          parsed.purchases = parsed.purchases.map((p: any) =>
            (p.productId === productId || (oldName && p.productName?.toLowerCase() === oldName.toLowerCase()))
              ? { ...p, productName: newName, productId }
              : p
          );
        }

        if (Array.isArray(parsed.sales)) {
          parsed.sales = parsed.sales.map((s: any) =>
            (s.productId === productId || (oldName && s.productName?.toLowerCase() === oldName.toLowerCase()))
              ? { ...s, productName: newName, productId }
              : s
          );
        }

        await prisma.siteSetting.update({
          where: { key: 'catalog_store_data' },
          data: { value: JSON.stringify(parsed) },
        });
      } catch (storeErr) {
        console.warn('[rename] Error actualizando catalog_store_data:', storeErr);
      }
    }

    // 4. Actualizar en order_items (pedidos web)
    let orderItemsUpdated = 0;
    try {
      const resOrder = await prisma.orderItem.updateMany({
        where: {
          OR: [
            { product_id: productId },
            ...(oldName ? [{ product_name: oldName }] : []),
          ],
        },
        data: { product_name: newName, product_id: productId },
      });
      orderItemsUpdated = resOrder.count;
    } catch {}

    return NextResponse.json({
      success: true,
      batchItemsUpdated,
      orderItemsUpdated,
    });
  } catch (error: any) {
    console.error('[PATCH /api/admin/products/[productId]/rename] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
