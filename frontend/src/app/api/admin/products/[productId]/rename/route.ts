import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/products/[productId]/rename
 * Actualiza el nombre de un producto en todas las tablas relacionadas de la BD.
 * Úsalo cuando se renombra un producto desde el panel de administración.
 *
 * Body: { newName: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const { productId } = params;
    const body = await req.json();
    const newName = (body?.newName || '').trim();

    if (!productId || !newName) {
      return NextResponse.json(
        { error: 'productId y newName son requeridos' },
        { status: 400 }
      );
    }

    // 1. Actualizar en purchase_batch_items (historial de compras)
    const batchResult = await prisma.purchaseBatchItem.updateMany({
      where: { product_id: productId },
      data: { product_name: newName },
    });

    // 2. Actualizar en order_items (historial de ventas web)
    // order_items usa product_id como String, igual que purchase_batch_items
    let orderResult = { count: 0 };
    try {
      orderResult = await prisma.orderItem.updateMany({
        where: { product_id: productId },
        data: { product_name: newName },
      });
    } catch {
      // order_items puede no tener todos los productos (es opcional)
    }

    // 3. Actualizar también el catalog_store_data (la forma más rápida: re-leer y parchearlo)
    try {
      const setting = await prisma.siteSetting.findUnique({
        where: { key: 'catalog_store_data' },
      });

      if (setting?.value) {
        const parsed = JSON.parse(setting.value as string);

        // Actualizar nombre en products
        if (Array.isArray(parsed.products)) {
          parsed.products = parsed.products.map((p: any) =>
            p.id === productId ? { ...p, name: newName } : p
          );
        }

        // Actualizar productName en purchases
        if (Array.isArray(parsed.purchases)) {
          parsed.purchases = parsed.purchases.map((p: any) =>
            p.productId === productId ? { ...p, productName: newName } : p
          );
        }

        // Actualizar productName en sales
        if (Array.isArray(parsed.sales)) {
          parsed.sales = parsed.sales.map((s: any) =>
            s.productId === productId ? { ...s, productName: newName } : s
          );
        }

        await prisma.siteSetting.update({
          where: { key: 'catalog_store_data' },
          data: { value: JSON.stringify(parsed) },
        });
      }
    } catch (storeErr) {
      console.warn('[rename] No se pudo actualizar catalog_store_data:', storeErr);
    }

    return NextResponse.json({
      success: true,
      batchItemsUpdated: batchResult.count,
      orderItemsUpdated: orderResult.count,
    });
  } catch (error: any) {
    console.error('[PATCH /api/admin/products/[productId]/rename] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
