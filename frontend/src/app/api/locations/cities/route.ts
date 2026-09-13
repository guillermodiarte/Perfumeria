import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/locations/cities?province_id=1&q=cordoba
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const provinceId = searchParams.get('province_id');
    const q = searchParams.get('q');

    const cities = await prisma.city.findMany({
      where: {
        ...(provinceId && { province_id: parseInt(provinceId) }),
        ...(q && { name: { contains: q } }),
      },
      orderBy: { name: 'asc' },
      take: 50,
    });

    return NextResponse.json(cities);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
