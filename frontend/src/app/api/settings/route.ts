import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth';

// GET /api/settings - all public settings
export async function GET(req: NextRequest) {
  try {
    const settings = await prisma.siteSetting.findMany();
    return NextResponse.json(settings.map(s => {
      let value = s.value;
      try { value = JSON.parse(s.value as string); } catch {}
      return { id: s.id, key: s.key, value };
    }));
  } catch {
    return NextResponse.json([]);
  }
}
