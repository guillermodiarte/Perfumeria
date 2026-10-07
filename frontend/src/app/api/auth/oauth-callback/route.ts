import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';
import { createToken } from '@/lib/auth';

/**
 * POST /api/auth/oauth-callback
 * Called from the client after a successful NextAuth OAuth sign-in.
 * Finds or creates the Customer record and returns our own JWT.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ detail: 'No hay sesión OAuth activa' }, { status: 401 });
    }

    const { email, name, image } = session.user;

    // Find or create the customer
    let customer = await prisma.customer.findUnique({ where: { email: email! } });

    if (!customer) {
      // Auto-approve OAuth users — they have already verified their identity with a provider
      customer = await prisma.customer.create({
        data: {
          email: email!,
          password_hash: '', // No password for OAuth users
          name: name || email!.split('@')[0],
          phone: '', // Will be filled in profile if needed
          email_verified: true,
          is_approved: true,
          created_at: new Date(),
        },
      });
    } else if (!customer.is_approved) {
      // Existing account pending approval — auto-approve via OAuth
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: { is_approved: true, email_verified: true },
      });
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
    console.error('OAuth callback error:', error);
    return NextResponse.json({ detail: 'Error interno del servidor' }, { status: 500 });
  }
}
