import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/locations/provinces/[id]/cities
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const provinceId = parseInt(params.id, 10);
    if (isNaN(provinceId)) {
      return NextResponse.json({ detail: 'ID de provincia inválido' }, { status: 400 });
    }

    const cities = await prisma.city.findMany({
      where: { province_id: provinceId },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(cities);
  } catch (error: any) {
    console.error('Error getting cities:', error);
    return NextResponse.json({ detail: error.message || 'Error al obtener ciudades' }, { status: 500 });
  }
}
