import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/settings/[key]
export async function GET(req: NextRequest, { params }: { params: { key: string } }) {
  try {
    const { key } = params;
    const setting = await prisma.siteSetting.findUnique({
      where: { key },
    });

    if (!setting) {
      return NextResponse.json({ detail: 'Configuración no encontrada' }, { status: 404 });
    }

    let parsedVal = setting.value;
    try {
      parsedVal = JSON.parse(setting.value);
    } catch {
      // keep raw string
    }

    return NextResponse.json({
      id: setting.id,
      key: setting.key,
      value: parsedVal,
    });
  } catch (error: any) {
    console.error('Error fetching setting:', error);
    return NextResponse.json({ detail: error.message || 'Error al obtener configuración' }, { status: 500 });
  }
}
