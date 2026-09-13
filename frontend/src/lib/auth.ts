import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { prisma } from './prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-lyg-token-998877';
const TOKEN_EXPIRY = '7d';

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

// Extract token from X-API-KEY header or Authorization Bearer
export function getTokenFromRequest(req: NextRequest): string | null {
  const apiKey = req.headers.get('x-api-key');
  if (apiKey) return apiKey;
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

// Get current customer from token
export async function getCurrentCustomer(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || payload.type !== 'customer') return null;
  const sub = payload.sub as string;
  const customer = await prisma.customer.findUnique({ where: { email: sub } });
  return customer;
}

// Get current admin from token
export async function getCurrentAdmin(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || payload.type !== 'admin') return null;
  const sub = payload.sub as string;
  const admin = await prisma.admin.findUnique({ where: { email: sub } });
  return admin;
}
