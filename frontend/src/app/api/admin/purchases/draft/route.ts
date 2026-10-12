export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth';

const DRAFT_KEY = 'admin_purchase_draft';

// GET /api/admin/purchases/draft
// Obtiene el borrador compartido de compras cargado por cualquier administrador
export async function GET(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) {
    return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });
  }

  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: DRAFT_KEY },
    });

    if (!setting || !setting.value) {
      return NextResponse.json({ draft: null });
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(setting.value);
    } catch {
      return NextResponse.json({ draft: null });
    }

    return NextResponse.json({
      draft: parsed?.draft || null,
      updated_by: parsed?.updated_by || null,
      updated_at: parsed?.updated_at || null,
    });
  } catch (error: any) {
    console.error('Error al obtener borrador de compras:', error);
    return NextResponse.json({ draft: null });
  }
}

// PUT /api/admin/purchases/draft
// Guarda o actualiza el borrador compartido para que todos los admins lo vean en sus dispositivos
export async function PUT(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) {
    return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const draft = body.draft;

    if (!draft) {
      await prisma.siteSetting.deleteMany({
        where: { key: DRAFT_KEY },
      });
      return NextResponse.json({ success: true, draft: null });
    }

    const payload = {
      draft,
      updated_by: admin.name || admin.email || 'Admin',
      updated_at: new Date().toISOString(),
    };

    await prisma.siteSetting.upsert({
      where: { key: DRAFT_KEY },
      update: { value: JSON.stringify(payload) },
      create: { key: DRAFT_KEY, value: JSON.stringify(payload) },
    });

    return NextResponse.json({
      success: true,
      updated_at: payload.updated_at,
      updated_by: payload.updated_by,
    });
  } catch (error: any) {
    console.error('Error al guardar borrador de compras:', error);
    return NextResponse.json({ detail: 'Error guardando borrador compartido' }, { status: 500 });
  }
}

// DELETE /api/admin/purchases/draft
// Elimina el borrador compartido (cuando se completa la compra o se resetea)
export async function DELETE(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) {
    return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });
  }

  try {
    await prisma.siteSetting.deleteMany({
      where: { key: DRAFT_KEY },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al eliminar borrador de compras:', error);
    return NextResponse.json({ detail: 'Error eliminando borrador' }, { status: 500 });
  }
}
