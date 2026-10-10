import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/store/sync - Recupera el catálogo y finanzas completo guardado en la base de datos
export async function GET(req: NextRequest) {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: 'catalog_store_data' },
    });

    if (!setting || !setting.value) {
      return NextResponse.json({ data: null });
    }

    let parsed = setting.value;
    try {
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
    } catch (e) {
      console.error('Error parsing catalog_store_data from DB:', e);
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({ data: parsed }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (error: any) {
    console.error('GET /api/store/sync error:', error);
    return NextResponse.json({ error: error.message, data: null }, { status: 500 });
  }
}

// POST /api/store/sync - Guarda y sincroniza todo el estado del catálogo en la base de datos SQLite
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
    }

    const valueToStore = JSON.stringify({
      products: body.products || [],
      categoriesConfig: body.categoriesConfig || [],
      variantGroupsConfig: body.variantGroupsConfig || [],
      perfumeTypesConfig: body.perfumeTypesConfig || [],
      purchases: body.purchases || [],
      sales: body.sales || [],
      globalMarkupPrc: body.globalMarkupPrc ?? 50,
      wholesaleConfig: body.wholesaleConfig || { minQuantity: 3, discountPercentage: 15 },
      updatedAt: new Date().toISOString(),
    });

    await prisma.siteSetting.upsert({
      where: { key: 'catalog_store_data' },
      update: { value: valueToStore },
      create: { key: 'catalog_store_data', value: valueToStore },
    });

    // Sincronizar nombres actualizados en purchase_batch_items para mantener consistencia en la DB
    if (Array.isArray(body.products)) {
      for (const prod of body.products) {
        if (prod.id && prod.name) {
          await prisma.purchaseBatchItem.updateMany({
            where: { product_id: prod.id },
            data: { product_name: prod.name },
          }).catch(() => {});
        }
      }
    }

    try {
      revalidatePath('/');
      revalidatePath('/catalog');
      revalidatePath('/admin');
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'Catálogo y datos sincronizados correctamente en la base de datos.',
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('POST /api/store/sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
