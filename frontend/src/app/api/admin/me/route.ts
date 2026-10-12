export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin, createToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

// GET /api/admin/me
// Devuelve los datos del admin autenticado y un token renovado.
// La PWA instalada usa esto para mantener la sesión sin re-autenticar.
export async function GET(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) {
    return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });
  }

  // Generar token renovado para mantener la sesión activa en la PWA
  const newToken = createToken({ sub: admin.email, type: 'admin', id: admin.id, role: admin.role });

  return NextResponse.json({
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    // Token renovado: el cliente debe guardarlo para reemplazar el anterior
    refreshed_token: newToken,
  });
}
