import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin, hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function customerToPublic(c: any) {
  return {
    id: c.id,
    email: c.email,
    name: c.name,
    phone: c.phone,
    address: c.address,
    province: c.province,
    city: c.city,
    postal_code: c.postal_code,
    is_wholesale: c.is_wholesale,
    wholesale_until: c.wholesale_until,
    email_verified: c.email_verified,
    is_approved: c.is_approved,
    created_at: c.created_at,
  };
}

// GET /api/admin/users - list customers
export async function GET(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) {
    return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });
  }
  const customers = await prisma.customer.findMany({ orderBy: { created_at: 'desc' } });
  return NextResponse.json(customers.map(customerToPublic));
}

// POST /api/admin/users - create admin user
export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) {
    return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { email, password, name, role } = body;
    if (!email || !password || !name) {
      return NextResponse.json({ detail: 'Campos requeridos: email, password, name' }, { status: 422 });
    }
    const existing = await prisma.admin.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ detail: 'El email ya está registrado como administrador' }, { status: 400 });
    }
    const newAdmin = await prisma.admin.create({
      data: { email, password_hash: hashPassword(password), name, role: role || 'editor' },
    });
    return NextResponse.json({ id: newAdmin.id, email: newAdmin.email, name: newAdmin.name, role: newAdmin.role });
  } catch (error: any) {
    return NextResponse.json({ detail: 'Error creando administrador' }, { status: 500 });
  }
}
