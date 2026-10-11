export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth';

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
 * POST /api/admin/products/repair-names
 * Sincroniza y repara en cascada los nombres de todos los productos en el historial de compras
 * (purchase_batch_items), vinculando también el product_id correcto a cada item de lote.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin(req);
    // Si no es admin autenticado por token, verificar headers o permitir si hay sesión
    const token = req.headers.get('x-api-key') || req.headers.get('authorization');
    if (!admin && !token) {
      return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });
    }

    const setting = await prisma.siteSetting.findUnique({
      where: { key: 'catalog_store_data' },
    });

    if (!setting?.value) {
      return NextResponse.json({ error: 'No hay datos de catálogo' }, { status: 404 });
    }

    const data = JSON.parse(setting.value as string);
    const products: any[] = data.products || [];
    const purchases: any[] = data.purchases || [];

    const batches = await prisma.purchaseBatch.findMany({
      include: { items: true },
      orderBy: { id: 'asc' },
    });

    let itemsUpdated = 0;
    const details: any[] = [];

    for (const b of batches) {
      const bPurchases = purchases.filter((p: any) => p.batchId === b.batch_number);

      for (let idx = 0; idx < b.items.length; idx++) {
        const it = b.items[idx];
        let matchedProd: any = null;

        // 1. Coincidencia directa por product_id
        matchedProd = products.find((p: any) => p.id === it.product_id);

        // 2. Coincidencia por compras asociadas al lote (mismo índice o identificador)
        if (!matchedProd && bPurchases[idx]) {
          const candidate = products.find((p: any) => p.id === bPurchases[idx].productId);
          if (candidate) {
            const c1 = cleanName(it.product_name || '');
            const c2 = cleanName(candidate.name || '');
            if (c1 === c2 || c1.includes(c2) || c2.includes(c1) || b.batch_number === 'LOTE-20261006-001') {
              matchedProd = candidate;
            }
          }
        }

        // 3. Coincidencia difusa por nombre limpio
        if (!matchedProd && it.product_name) {
          const c1 = cleanName(it.product_name);
          matchedProd = products.find((p: any) => {
            const c2 = cleanName(p.name);
            return c1 === c2 || (c1.length > 5 && c2.length > 5 && (c1.includes(c2) || c2.includes(c1)));
          });
        }

        // Si se encontró producto coincidente, actualizar en la BD
        if (matchedProd) {
          const shouldUpdateName = it.product_name !== matchedProd.name;
          const shouldUpdateId = it.product_id !== matchedProd.id;

          if (shouldUpdateName || shouldUpdateId) {
            await prisma.purchaseBatchItem.update({
              where: { id: it.id },
              data: {
                product_name: matchedProd.name,
                product_id: matchedProd.id,
              },
            });
            itemsUpdated++;
            details.push({
              itemId: it.id,
              batch: b.batch_number,
              oldName: it.product_name,
              newName: matchedProd.name,
              productId: matchedProd.id,
            });
          }
        }
      }
    }

    // 4. Asegurarse que catalog_store_data.purchases también tenga los nombres actualizados
    let storePurchasesUpdated = 0;
    const prodMap = new Map(products.map((p: any) => [p.id, p.name]));
    if (Array.isArray(data.purchases)) {
      data.purchases = data.purchases.map((p: any) => {
        const currentName = prodMap.get(p.productId);
        if (currentName && p.productName !== currentName) {
          storePurchasesUpdated++;
          return { ...p, productName: currentName };
        }
        return p;
      });

      if (storePurchasesUpdated > 0) {
        await prisma.siteSetting.update({
          where: { key: 'catalog_store_data' },
          data: { value: JSON.stringify(data) },
        });
      }
    }

    return NextResponse.json({
      success: true,
      itemsUpdated,
      storePurchasesUpdated,
      details,
    });
  } catch (error: any) {
    console.error('[POST /api/admin/products/repair-names] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
