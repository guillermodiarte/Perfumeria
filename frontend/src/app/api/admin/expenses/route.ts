export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentAdmin, isSuperAdmin } from '@/lib/auth';

async function initExpensesTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "expenses" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "category" TEXT NOT NULL,
      "date" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT,
      "quantity" REAL DEFAULT 1,
      "unit_price" REAL DEFAULT 0,
      "amount" REAL NOT NULL DEFAULT 0,
      "payment_method" TEXT,
      "created_by" TEXT,
      "created_at" TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "expenses_date_idx" ON "expenses"("date");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "expenses_category_idx" ON "expenses"("category");
  `);
}

function canManageExpenses(admin: any): boolean {
  if (!admin) return false;
  return isSuperAdmin(admin) || admin.role === 'admin';
}

// GET /api/admin/expenses
// Permite listar los gastos filtrados por año, mes y/o categoría
export async function GET(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) {
    return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });
  }

  try {
    await initExpensesTable();

    const { searchParams } = new URL(req.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const category = searchParams.get('category');

    let sql = `SELECT * FROM "expenses" WHERE 1=1`;
    const params: any[] = [];

    if (year && month) {
      const paddedMonth = month.toString().padStart(2, '0');
      const prefix = `${year}-${paddedMonth}%`;
      sql += ` AND "date" LIKE ?`;
      params.push(prefix);
    } else if (year) {
      const prefix = `${year}-%`;
      sql += ` AND "date" LIKE ?`;
      params.push(prefix);
    }

    if (category) {
      sql += ` AND "category" = ?`;
      params.push(category);
    }

    sql += ` ORDER BY "date" DESC, "id" DESC`;

    const expenses: any = await prisma.$queryRawUnsafe(sql, ...params);
    return NextResponse.json(expenses || []);
  } catch (error: any) {
    console.error('Error al obtener gastos:', error);
    return NextResponse.json({ detail: 'Error al obtener gastos' }, { status: 500 });
  }
}

// POST /api/admin/expenses
// Crea un nuevo registro de gasto operativo
export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) {
    return NextResponse.json({ detail: 'No autorizado' }, { status: 401 });
  }
  if (!canManageExpenses(admin)) {
    return NextResponse.json({ detail: 'Acceso denegado: solo Administradores pueden registrar gastos' }, { status: 403 });
  }

  try {
    await initExpensesTable();

    const body = await req.json();
    const category = (body.category || 'servicios').trim();
    const date = (body.date || new Date().toISOString().slice(0, 10)).trim();
    const title = (body.title || '').trim();
    const description = (body.description || '').trim();
    const quantity = Number(body.quantity) || 1;
    const unit_price = Number(body.unit_price) || 0;
    let amount = Number(body.amount);

    if (isNaN(amount) || amount <= 0) {
      if (quantity > 0 && unit_price > 0) {
        amount = quantity * unit_price;
      } else {
        amount = 0;
      }
    }

    if (!title) {
      return NextResponse.json({ detail: 'El detalle / concepto es requerido' }, { status: 400 });
    }
    if (amount <= 0) {
      return NextResponse.json({ detail: 'El monto total debe ser mayor a 0' }, { status: 400 });
    }

    const payment_method = (body.payment_method || '').trim();
    const created_by = admin.name || admin.email || 'Admin';

    await prisma.$executeRawUnsafe(
      `INSERT INTO "expenses" ("category", "date", "title", "description", "quantity", "unit_price", "amount", "payment_method", "created_by")
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      category,
      date,
      title,
      description || null,
      quantity,
      unit_price,
      amount,
      payment_method || null,
      created_by
    );

    const created: any = await prisma.$queryRawUnsafe(
      `SELECT * FROM "expenses" WHERE "id" = last_insert_rowid()`
    );

    return NextResponse.json(created && created[0] ? created[0] : { success: true }, { status: 201 });
  } catch (error: any) {
    console.error('Error al crear gasto:', error);
    return NextResponse.json({ detail: 'Error al registrar gasto' }, { status: 500 });
  }
}
