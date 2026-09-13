import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/locations/provinces
export async function GET(req: NextRequest) {
  try {
    const provinces = await prisma.province.findMany({ orderBy: { name: 'asc' } });
    return NextResponse.json(provinces);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
