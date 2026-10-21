import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth';

const DEFAULT_SHIPPING = {
  delivery_enabled: true,
  delivery_cost: 0,
};

// GET /api/admin/settings/shipping
export async function GET(req: NextRequest) {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "site_settings" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "key" TEXT NOT NULL,
        "value" TEXT NOT NULL
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "site_settings_key_key" ON "site_settings"("key");
    `);

    const setting = await prisma.siteSetting.findUnique({
      where: { key: 'shipping_config' },
    });

    if (!setting) {
      return NextResponse.json(DEFAULT_SHIPPING);
    }

    try {
      const parsed = JSON.parse(setting.value);
      return NextResponse.json({
        delivery_enabled: parsed.delivery_enabled ?? true,
        delivery_cost: Number(parsed.delivery_cost || 0),
      });
    } catch {
      return NextResponse.json(DEFAULT_SHIPPING);
    }
  } catch (error: any) {
    return NextResponse.json(DEFAULT_SHIPPING);
  }
}

// PUT /api/admin/settings/shipping
export async function PUT(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const config = {
      delivery_enabled: body.delivery_enabled ?? true,
      delivery_cost: Math.max(0, Number(body.delivery_cost || 0)),
    };

    // Garantizar que la tabla site_settings exista
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "site_settings" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "key" TEXT NOT NULL,
        "value" TEXT NOT NULL
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "site_settings_key_key" ON "site_settings"("key");
    `);

    await prisma.siteSetting.upsert({
      where: { key: 'shipping_config' },
      update: { value: JSON.stringify(config) },
      create: { key: 'shipping_config', value: JSON.stringify(config) },
    });

    return NextResponse.json(config);
  } catch (error: any) {
    console.error('Error al guardar configuración de envíos:', error);
    return NextResponse.json({ detail: error?.message || 'Error al guardar configuración de envíos' }, { status: 500 });
  }
}
