import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, createToken } from '@/lib/auth';

// POST /api/admin/login
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ detail: 'Email y contraseña son requeridos' }, { status: 422 });
    }

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      return NextResponse.json({ detail: 'Credenciales incorrectas' }, { status: 401 });
    }

    if (!verifyPassword(password, admin.password_hash)) {
      return NextResponse.json({ detail: 'Credenciales incorrectas' }, { status: 401 });
    }

    const token = createToken({ sub: admin.email, type: 'admin', id: admin.id, role: admin.role });

    return NextResponse.json({
      access_token: token,
      token_type: 'bearer',
      role: admin.role || 'admin',
      name: admin.name,
      email: admin.email,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (error: any) {
    console.error('Admin login error:', error);
    return NextResponse.json({ detail: 'Error interno del servidor' }, { status: 500 });
  }
}
