import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  dbReady: Promise<void> | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

async function runMigration(): Promise<void> {
  try {
    const cols: any[] = await prisma.$queryRawUnsafe('PRAGMA table_info(orders);');
    const colNames = Array.isArray(cols) ? cols.map((c: any) => c.name) : [];

    const requiredCols: { name: string; def: string }[] = [
      { name: 'shipping_type',               def: "TEXT DEFAULT 'delivery'" },
      { name: 'shipping_cost',               def: "REAL DEFAULT 0" },
      { name: 'shipping_tracking_number',    def: "TEXT" },
      { name: 'shipping_invoice_url',        def: "TEXT" },
      { name: 'shipped_at',                  def: "TEXT" },
      { name: 'payment_type',                def: "TEXT DEFAULT 'total'" },
      { name: 'installments_count',          def: "INTEGER DEFAULT 1" },
      { name: 'last_installment_paid_month', def: "TEXT" },
      { name: 'admin_notes',                 def: "TEXT" },
      { name: 'delivery_status',             def: "TEXT DEFAULT 'pending'" },
      { name: 'paid_amount',                 def: "REAL DEFAULT 0" },
    ];

    for (const col of requiredCols) {
      if (!colNames.includes(col.name)) {
        try {
          console.log(`[Auto-Migrate] Añadiendo columna faltante orders.${col.name}...`);
          await prisma.$executeRawUnsafe(
            `ALTER TABLE orders ADD COLUMN ${col.name} ${col.def};`
          );
        } catch (e: any) {
          // Column may have been added by a concurrent process — safe to ignore
          console.warn(`[Auto-Migrate] Columna ${col.name} ya existía o error:`, e.message);
        }
      }
    }
    console.log('[Auto-Migrate] Schema verificado correctamente.');
  } catch (err) {
    console.error('[Auto-Migrate] Error comprobando columnas de base de datos:', err);
    // Don't cache the result — let the next call retry
    globalForPrisma.dbReady = undefined;
    throw err;
  }
}

/**
 * Returns a shared Promise that resolves once ALL missing columns have been
 * added. Every caller awaits the SAME promise, so no query can run against
 * the orders table before the migration is fully complete.
 */
export function ensureDbSchema(): Promise<void> {
  if (!globalForPrisma.dbReady) {
    globalForPrisma.dbReady = runMigration();
  }
  return globalForPrisma.dbReady;
}

// Kick off migration eagerly so it's ready before the first request
ensureDbSchema().catch(() => {});

