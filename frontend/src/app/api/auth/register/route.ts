import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

// POST /api/auth/register
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name, phone, address, province, city, postal_code } = body;

    if (!email || !password || !name || !phone) {
      return NextResponse.json({ detail: 'Email, contraseña, nombre y celular son requeridos' }, { status: 422 });
    }

    const existingEmail = await prisma.customer.findUnique({ where: { email } });
    if (existingEmail) {
      if (!existingEmail.is_approved) {
        return NextResponse.json(
          { detail: 'pending_approval:Tu solicitud de registro ya está en proceso a la espera de la aprobación de un administrador.' },
          { status: 400 }
        );
      } else {
        return NextResponse.json(
          { detail: 'El correo electrónico ya está registrado. Por favor inicia sesión.' },
          { status: 400 }
        );
      }
    }

    const existingPhone = await prisma.customer.findUnique({ where: { phone } });
    if (existingPhone) {
      if (!existingPhone.is_approved) {
        return NextResponse.json(
          { detail: 'pending_approval:Tu solicitud con este número de celular ya está en proceso de aprobación.' },
          { status: 400 }
        );
      } else {
        return NextResponse.json({ detail: 'El número de celular ya está registrado.' }, { status: 400 });
      }
    }

    const verificationToken = Math.random().toString(36).substring(2, 15);
    const customer = await prisma.customer.create({
      data: {
        email,
        password_hash: hashPassword(password),
        name,
        phone,
        address: address || null,
        province: province || null,
        city: city || null,
        postal_code: postal_code || null,
        email_verified: false,
        is_approved: false,
        verification_token: verificationToken,
        created_at: new Date(),
      },
    });

    return NextResponse.json({
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
    });
  } catch (error: any) {
    console.error('Register error:', error);
    return NextResponse.json({ detail: 'Error interno del servidor' }, { status: 500 });
  }
}
