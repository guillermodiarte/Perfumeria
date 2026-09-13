import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/auth/verify-email?token=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ detail: 'Token inválido o expirado.' }, { status: 400 });
    }

    const user = await prisma.customer.findFirst({
      where: { verification_token: token },
    });

    if (!user) {
      return NextResponse.json({ detail: 'Token inválido o expirado.' }, { status: 400 });
    }

    await prisma.customer.update({
      where: { id: user.id },
      data: {
        email_verified: true,
        verification_token: null,
      },
    });

    return NextResponse.json({ status: 'ok', message: 'Correo verificado correctamente.' });
  } catch (error: any) {
    console.error('Verify email error:', error);
    return NextResponse.json({ detail: 'Error al verificar email' }, { status: 500 });
  }
}
