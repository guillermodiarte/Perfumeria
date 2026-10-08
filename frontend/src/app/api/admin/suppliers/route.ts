export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth';

// GET /api/admin/suppliers - listar proveedores
export async function GET(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(suppliers);
  } catch (error: any) {
    return NextResponse.json({ detail: 'Error al listar proveedores' }, { status: 500 });
  }
}

// POST /api/admin/suppliers - crear proveedor
export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const name = (body.name || '').trim();
    if (!name) {
      return NextResponse.json({ detail: 'El nombre del proveedor no puede estar vacío' }, { status: 400 });
    }

    const existing = await prisma.supplier.findUnique({
      where: { name },
    });
    if (existing) {
      return NextResponse.json(existing);
    }

    const supplier = await prisma.supplier.create({
      data: { name },
    });
    return NextResponse.json(supplier);
  } catch (error: any) {
    return NextResponse.json({ detail: 'Error al crear proveedor' }, { status: 500 });
  }
}
