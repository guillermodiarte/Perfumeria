import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/admin/settings/[key]
export async function GET(req: NextRequest, { params }: { params: { key: string } }) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    const setting = await prisma.siteSetting.findUnique({ where: { key: params.key } });
    if (!setting) return NextResponse.json({ key: params.key, value: null });
    let value = setting.value;
    try { value = JSON.parse(setting.value as string); } catch {}
    return NextResponse.json({ id: setting.id, key: setting.key, value });
  } catch {
    return NextResponse.json({ key: params.key, value: null });
  }
}

// PUT /api/admin/settings/[key]
export async function PUT(req: NextRequest, { params }: { params: { key: string } }) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const value = typeof body.value === 'string' ? body.value : JSON.stringify(body.value);

    const setting = await prisma.siteSetting.upsert({
      where: { key: params.key },
      update: { value },
      create: { key: params.key, value },
    });

    try {
      revalidatePath('/');
      revalidatePath('/admin');
    } catch {}

    let parsedValue = setting.value;
    try { parsedValue = JSON.parse(setting.value as string); } catch {}
    return NextResponse.json({ id: setting.id, key: setting.key, value: parsedValue });
  } catch (error) {
    return NextResponse.json({ detail: 'Error guardando configuración' }, { status: 500 });
  }
}
