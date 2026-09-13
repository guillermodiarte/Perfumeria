import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer, hashPassword, verifyPassword } from '@/lib/auth';

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

// GET /api/auth/me
export async function GET(req: NextRequest) {
  const customer = await getCurrentCustomer(req);
  if (!customer) {
    return NextResponse.json({ detail: 'No autenticado' }, { status: 401 });
  }
  return NextResponse.json(customerToPublic(customer));
}

// PUT or PATCH /api/auth/me (update profile)
async function handleUpdate(req: NextRequest) {
  const customer = await getCurrentCustomer(req);
  if (!customer) {
    return NextResponse.json({ detail: 'No autenticado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, phone, address, province, city, postal_code, password, current_password, email } = body;

    // Check email uniqueness if changing
    if (email && email !== customer.email) {
      const existingEmail = await prisma.customer.findUnique({ where: { email } });
      if (existingEmail) {
        return NextResponse.json({ detail: 'El correo electrónico ya está en uso.' }, { status: 400 });
      }
    }

    // If changing password, verify current password first if provided
    if (password) {
      if (current_password && !verifyPassword(current_password, customer.password_hash)) {
        return NextResponse.json({ detail: 'Contraseña actual incorrecta' }, { status: 400 });
      }
    }

    // Check if new phone conflicts
    if (phone && phone !== customer.phone) {
      const existingPhone = await prisma.customer.findUnique({ where: { phone } });
      if (existingPhone) {
        return NextResponse.json({ detail: 'El teléfono ya está registrado' }, { status: 400 });
      }
    }

    const updated = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        ...(email !== undefined && { email }),
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(province !== undefined && { province }),
        ...(city !== undefined && { city }),
        ...(postal_code !== undefined && { postal_code }),
        ...(password ? { password_hash: hashPassword(password) } : {}),
      },
    });

    return NextResponse.json(customerToPublic(updated));
  } catch (error: any) {
    console.error('Update profile error:', error);
    return NextResponse.json({ detail: 'Error actualizando perfil' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  return handleUpdate(req);
}

export async function PATCH(req: NextRequest) {
  return handleUpdate(req);
}
