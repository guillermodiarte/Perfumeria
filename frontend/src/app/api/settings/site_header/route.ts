import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/settings/site_header
export async function GET(req: NextRequest) {
  try {
    const setting = await prisma.siteSetting.findUnique({ where: { key: 'site_header' } });
    if (!setting) return NextResponse.json({ key: 'site_header', value: {} });
    let value = setting.value;
    try { value = JSON.parse(setting.value as string); } catch {}
    return NextResponse.json({ key: setting.key, value });
  } catch {
    return NextResponse.json({ key: 'site_header', value: {} });
  }
}
