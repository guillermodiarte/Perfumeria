import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  dbChecked: boolean | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

let isMigrating = false;

export async function ensureDbSchema() {
  if (globalForPrisma.dbChecked || isMigrating) return;
  isMigrating = true;
  try {
    const cols: any[] = await prisma.$queryRawUnsafe('PRAGMA table_info(orders);');
    const colNames = Array.isArray(cols) ? cols.map(c => c.name) : [];
    
    const requiredCols: { name: string; def: string }[] = [
      { name: 'shipping_type', def: "TEXT DEFAULT 'delivery'" },
      { name: 'shipping_cost', def: "REAL DEFAULT 0" },
      { name: 'shipping_tracking_number', def: "TEXT" },
      { name: 'shipping_invoice_url', def: "TEXT" },
      { name: 'shipped_at', def: "TEXT" },
      { name: 'payment_type', def: "TEXT DEFAULT 'total'" },
      { name: 'installments_count', def: "INTEGER DEFAULT 1" },
      { name: 'last_installment_paid_month', def: "TEXT" },
      { name: 'admin_notes', def: "TEXT" },
      { name: 'delivery_status', def: "TEXT DEFAULT 'pending'" },
      { name: 'paid_amount', def: "REAL DEFAULT 0" }
    ];

    for (const col of requiredCols) {
      if (!colNames.includes(col.name)) {
        try {
          console.log(`[Auto-Migrate] Añadiendo columna faltante orders.${col.name}...`);
          await prisma.$executeRawUnsafe(`ALTER TABLE orders ADD COLUMN ${col.name} ${col.def};`);
        } catch (e: any) {
          console.warn(`[Auto-Migrate] Columna ${col.name} ya existía o error:`, e.message);
        }
      }
    }
    globalForPrisma.dbChecked = true;
  } catch (err) {
    console.error('[Auto-Migrate] Error comprobando columnas de base de datos:', err);
  } finally {
    isMigrating = false;
  }
}

// Ejecutar verificación en background
ensureDbSchema().catch(() => {});

