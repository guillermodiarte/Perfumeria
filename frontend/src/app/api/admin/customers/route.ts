import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentAdmin, hashPassword } from '@/lib/auth';

// POST /api/admin/customers
export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const { email, password, name, phone, address, province, city, postal_code } = body;

    if (!email || !password || !name) {
      return NextResponse.json({ detail: 'Email, contraseña y nombre son requeridos.' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if email already exists
    const existingEmail = await prisma.customer.findUnique({
      where: { email: cleanEmail },
    });
    if (existingEmail) {
      return NextResponse.json({ detail: 'Ya existe una cuenta con este correo electrónico.' }, { status: 400 });
    }

    // Check if phone already exists if provided
    if (phone) {
      const existingPhone = await prisma.customer.findUnique({
        where: { phone: phone.trim() },
      });
      if (existingPhone) {
        return NextResponse.json({ detail: 'Ya existe una cuenta con este número de teléfono.' }, { status: 400 });
      }
    }

    const newCustomer = await prisma.customer.create({
      data: {
        email: cleanEmail,
        password_hash: hashPassword(password),
        name: name.trim(),
        phone: (phone || '').trim(),
        address: address?.trim() || null,
        province: province?.trim() || null,
        city: city?.trim() || null,
        postal_code: postal_code?.trim() || null,
        email_verified: true,
        is_approved: true,
      },
    });

    return NextResponse.json({
      id: newCustomer.id,
      email: newCustomer.email,
      name: newCustomer.name,
      phone: newCustomer.phone,
      is_approved: newCustomer.is_approved,
      is_wholesale: newCustomer.is_wholesale,
    });
  } catch (error: any) {
    console.error('Error creating customer from admin:', error);
    return NextResponse.json({ detail: error.message || 'Error al crear cliente' }, { status: 500 });
  }
}
