export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer, hashPassword, verifyPassword, createToken } from '@/lib/auth';

function customerToPublic(c: any) {
  return {
    id: c.id,
    email: c.email,
    name: c.name,
    phone: c.phone,
    dni: c.dni,
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
    const { name, phone, dni, address, province, city, postal_code, password, current_password, email } = body;

    const isPendingOAuthEmail = customer.email.endsWith('@pending.oauth');
    const cleanEmail = email ? email.trim().toLowerCase() : undefined;

    // Check email changes
    if (cleanEmail && cleanEmail !== customer.email) {
      const existingCustomer = await prisma.customer.findUnique({ where: { email: cleanEmail } });

      if (existingCustomer) {
        if (isPendingOAuthEmail) {
          // Merge pending OAuth temporary account into existing customer account
          await prisma.oAuthAccount.updateMany({
            where: { customer_id: customer.id },
            data: { customer_id: existingCustomer.id },
          });

          await prisma.cartItem.updateMany({
            where: { user_id: customer.id },
            data: { user_id: existingCustomer.id },
          });

          const merged = await prisma.customer.update({
            where: { id: existingCustomer.id },
            data: {
              ...(name && !existingCustomer.name ? { name } : {}),
              ...(phone && !existingCustomer.phone ? { phone } : {}),
              ...(dni && !existingCustomer.dni ? { dni } : {}),
              ...(address && !existingCustomer.address ? { address } : {}),
              ...(province && !existingCustomer.province ? { province } : {}),
              ...(city && !existingCustomer.city ? { city } : {}),
              ...(postal_code && !existingCustomer.postal_code ? { postal_code } : {}),
              email_verified: true,
              is_approved: true,
            },
          });

          await prisma.customer.delete({ where: { id: customer.id } });

          const newToken = createToken({ sub: merged.email, type: 'customer', id: merged.id });

          return NextResponse.json({
            ...customerToPublic(merged),
            access_token: newToken,
          });
        } else {
          return NextResponse.json({ detail: 'El correo electrónico ya está en uso.' }, { status: 400 });
        }
      }
    }

    // If changing password, verify current password first if provided
    if (password) {
      if (current_password && customer.password_hash && !verifyPassword(current_password, customer.password_hash)) {
        return NextResponse.json({ detail: 'Contraseña actual incorrecta' }, { status: 400 });
      }
    }

    // Check if new phone conflicts
    if (phone && phone !== customer.phone) {
      const existingPhone = await prisma.customer.findUnique({ where: { phone } });
      if (existingPhone && existingPhone.id !== customer.id) {
        return NextResponse.json({ detail: 'El teléfono ya está registrado' }, { status: 400 });
      }
    }

    const updated = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        ...(cleanEmail !== undefined && {
          email: cleanEmail,
          email_verified: isPendingOAuthEmail ? true : customer.email_verified,
        }),
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(dni !== undefined && { dni }),
        ...(address !== undefined && { address }),
        ...(province !== undefined && { province }),
        ...(city !== undefined && { city }),
        ...(postal_code !== undefined && { postal_code }),
        ...(password ? { password_hash: hashPassword(password) } : {}),
      },
    });

    let newToken: string | undefined;
    if (cleanEmail && cleanEmail !== customer.email) {
      newToken = createToken({ sub: updated.email, type: 'customer', id: updated.id });
    }

    return NextResponse.json({
      ...customerToPublic(updated),
      ...(newToken ? { access_token: newToken } : {}),
    });
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
