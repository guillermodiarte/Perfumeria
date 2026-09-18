import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/settings - all public settings
export async function GET(req: NextRequest) {
  try {
    const settings = await prisma.siteSetting.findMany();
    return NextResponse.json(settings.map(s => {
      let value = s.value;
      try { value = JSON.parse(s.value as string); } catch {}
      return { id: s.id, key: s.key, value };
    }), {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      }
    });
  } catch {
    return NextResponse.json([]);
  }
}
