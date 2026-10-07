import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';
import { createToken } from '@/lib/auth';

/**
 * POST /api/auth/oauth-callback
 * Called from client after NextAuth OAuth sign-in.
 * Links or creates the Customer record with multi-provider support.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ detail: 'No hay sesión OAuth activa' }, { status: 401 });
    }

    const provider = ((session as any).provider as string) || '';
    const providerAccountId = ((session as any).providerAccountId as string) || '';
    const rawEmail = session.user.email ? session.user.email.trim().toLowerCase() : null;
    const name = session.user.name || (rawEmail ? rawEmail.split('@')[0] : 'Usuario');

    let customer = null;

    // 1. Check if this specific OAuth account is already linked to a customer
    if (provider && providerAccountId) {
      const linkedAccount = await prisma.oAuthAccount.findUnique({
        where: {
          provider_provider_account_id: {
            provider,
            provider_account_id: providerAccountId,
          },
        },
        include: { customer: true },
      });

      if (linkedAccount?.customer) {
        customer = linkedAccount.customer;
      }
    }

    // 2. If not found by OAuth link, check by verified email (same email across Google/Facebook/Twitter)
    if (!customer && rawEmail) {
      customer = await prisma.customer.findUnique({
        where: { email: rawEmail },
      });

      if (customer) {
        // Auto-approve and mark email verified since OAuth verified it
        if (!customer.is_approved || !customer.email_verified) {
          customer = await prisma.customer.update({
            where: { id: customer.id },
            data: { is_approved: true, email_verified: true },
          });
        }

        // Link this provider account to the existing customer
        if (provider && providerAccountId) {
          await prisma.oAuthAccount.upsert({
            where: {
              provider_provider_account_id: {
                provider,
                provider_account_id: providerAccountId,
              },
            },
            create: {
              customer_id: customer.id,
              provider,
              provider_account_id: providerAccountId,
            },
            update: {
              customer_id: customer.id,
            },
          });
        }
      }
    }

    // 3. If customer still does not exist, create new customer
    if (!customer) {
      // If provider gave no email (e.g. Twitter without email permission), use a unique pending placeholder
      const emailToUse =
        rawEmail ||
        `temp_oauth_${provider || 'unknown'}_${providerAccountId || Math.random().toString(36).slice(2)}@pending.oauth`;

      customer = await prisma.customer.create({
        data: {
          email: emailToUse,
          password_hash: '',
          name: name,
          phone: null,
          email_verified: Boolean(rawEmail),
          is_approved: true,
          created_at: new Date(),
        },
      });

      if (provider && providerAccountId) {
        await prisma.oAuthAccount.create({
          data: {
            customer_id: customer.id,
            provider,
            provider_account_id: providerAccountId,
          },
        });
      }
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
        dni: customer.dni,
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
