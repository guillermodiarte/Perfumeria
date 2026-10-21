import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { prisma } from './prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-lyg-token-998877';
const TOKEN_EXPIRY = '365d'; // Sesión larga para PWA admin instalada

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(plain: string, hashed: string): boolean {
  return bcrypt.compareSync(plain, hashed);
}

export function createToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): Record<string, unknown> | null {
  try {
    return jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
  } catch {
    return null;
  }
}

import { getServerSession } from 'next-auth';
import { authOptions } from './authOptions';

// Extract token from X-API-KEY header or Authorization Bearer
export function getTokenFromRequest(req: NextRequest): string | null {
  const apiKey = req.headers.get('x-api-key');
  if (apiKey) return apiKey;
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

// Get current customer from token or NextAuth session
export async function getCurrentCustomer(req?: NextRequest) {
  // 1. Check token in request headers
  if (req) {
    const token = getTokenFromRequest(req);
    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        const email = ((payload.sub as string) || (payload.email as string) || '').toLowerCase().trim();
        if (email) {
          let customer = await prisma.customer.findUnique({ where: { email } });
          // If it's an admin and no customer record exists, create one
          if (!customer && (payload.type === 'admin' || email === PROTECTED_SUPER_ADMIN_EMAIL)) {
            customer = await prisma.customer.create({
              data: {
                email,
                name: (payload.name as string) || 'Admin',
                is_approved: true,
                email_verified: true,
              },
            });
          }
          if (customer) return customer;
        }
      }
    }
  }

  // 2. Fallback: Check NextAuth session from cookies
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.email) {
      const email = session.user.email.toLowerCase().trim();
      let customer = await prisma.customer.findUnique({ where: { email } });
      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            email,
            name: session.user.name || email.split('@')[0],
            is_approved: true,
            email_verified: true,
          },
        });
      }
      if (customer) return customer;
    }
  } catch {
    // NextAuth session resolution not available in this context
  }

  return null;
}

export const PROTECTED_SUPER_ADMIN_EMAIL = 'guillermo.diarte@gmail.com';
export const VALID_ADMIN_ROLES = ['super_admin', 'admin', 'empleado', 'viewer', 'editor'];

export function isSuperAdmin(admin: { email?: string | null; role?: string | null } | null | undefined): boolean {
  if (!admin) return false;
  return admin.role === 'super_admin' || (admin.email || '').toLowerCase() === PROTECTED_SUPER_ADMIN_EMAIL;
}

// Get current admin from token or NextAuth session
export async function getCurrentAdmin(req?: NextRequest) {
  if (req) {
    const token = getTokenFromRequest(req);
    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        const role = (payload.role as string) || '';
        const email = ((payload.sub as string) || (payload.email as string) || '').toLowerCase().trim();
        const isAdmin = payload.type === 'admin' || VALID_ADMIN_ROLES.includes(role) || email === PROTECTED_SUPER_ADMIN_EMAIL;
        if (isAdmin) {
          const sub = (payload.sub as string) || email;
          let admin = await prisma.admin.findUnique({ where: { email: sub } });
          if (!admin && sub) {
            admin = {
              id: (payload.id as number) || 1,
              email: sub,
              name: (payload.name as string) || (payload.email as string) || 'Admin',
              role: (payload.role as string) || (email === PROTECTED_SUPER_ADMIN_EMAIL ? 'super_admin' : 'admin'),
              password_hash: '',
            } as any;
          }
          if (admin) return admin;
        }
      }
    }
  }

  // Fallback: Check NextAuth session from cookies
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.email) {
      const email = session.user.email.toLowerCase().trim();
      let admin = await prisma.admin.findUnique({ where: { email } });
      if (admin) return admin;
      if (email === PROTECTED_SUPER_ADMIN_EMAIL) {
        return {
          id: 1,
          email,
          name: session.user.name || 'Super Admin',
          role: 'super_admin',
          password_hash: '',
        } as any;
      }
    }
  } catch {
    // NextAuth session resolution not available in this context
  }

  return null;
}
