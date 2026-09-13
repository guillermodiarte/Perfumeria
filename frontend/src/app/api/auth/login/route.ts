import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, createToken } from '@/lib/auth';

// POST /api/auth/login and /api/auth/customer/login
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ detail: 'Email y contraseña son requeridos' }, { status: 422 });
    }

    const customer = await prisma.customer.findUnique({ where: { email } });
    if (!customer) {
      return NextResponse.json({ detail: 'Correo o contraseña incorrectos' }, { status: 401 });
    }

    if (!verifyPassword(password, customer.password_hash)) {
      return NextResponse.json({ detail: 'Correo o contraseña incorrectos' }, { status: 401 });
    }

    if (!customer.is_approved) {
      return NextResponse.json(
        { detail: 'pending_approval:Tu cuenta aún no ha sido aprobada por un administrador. Tu solicitud está en proceso.' },
        { status: 403 }
      );
    }

    const token = createToken({ sub: customer.email, type: 'customer', id: customer.id });

    return NextResponse.json({
      access_token: token,
      token_type: 'bearer',
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        province: customer.province,
        city: customer.city,
        postal_code: customer.postal_code,
        is_wholesale: customer.is_wholesale,
        wholesale_until: customer.wholesale_until,
        email_verified: customer.email_verified,
        is_approved: customer.is_approved,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ detail: 'Error interno del servidor' }, { status: 500 });
  }
}
