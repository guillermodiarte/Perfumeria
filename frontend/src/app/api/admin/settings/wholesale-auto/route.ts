import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth';

// GET /api/admin/settings/wholesale-auto
export async function GET(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    const setting = await prisma.siteSetting.findUnique({ where: { key: 'wholesale_auto_enabled' } });
    if (!setting) return NextResponse.json({ enabled: false, min_quantity: 6 });

    let parsed: any = setting.value;
    try { parsed = JSON.parse(setting.value as string); } catch {}

    if (typeof parsed === 'object' && parsed !== null) {
      return NextResponse.json({ enabled: Boolean(parsed.enabled), min_quantity: Number(parsed.min_quantity) || 6 });
    }
    return NextResponse.json({ enabled: Boolean(parsed), min_quantity: 6 });
  } catch {
    return NextResponse.json({ enabled: false, min_quantity: 6 });
  }
}

// PATCH /api/admin/settings/wholesale-auto
export async function PATCH(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  // Only super admins can toggle this
  const isSuperAdmin = admin.email.toLowerCase() === 'guillermo.diarte@gmail.com' || admin.role === 'superadmin' || admin.role === 'admin';
  if (!isSuperAdmin) {
    return NextResponse.json({ detail: 'Solo el super administrador puede cambiar esta configuración.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const enabled = Boolean(body.enabled ?? false);
    const min_quantity = Number(body.min_quantity ?? 6);

    const payload = JSON.stringify({ enabled, min_quantity });
    await prisma.siteSetting.upsert({
      where: { key: 'wholesale_auto_enabled' },
      update: { value: payload },
      create: { key: 'wholesale_auto_enabled', value: payload },
    });

    return NextResponse.json({ status: 'ok', enabled, min_quantity });
  } catch {
    return NextResponse.json({ detail: 'Error guardando configuración' }, { status: 500 });
  }
}
