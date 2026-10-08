import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  hasCheckedSchema?: boolean;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

// Guardar en global tanto en dev como en producción para evitar múltiples instancias
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}

// Auto-migración: crea tablas y columnas faltantes al iniciar el servidor.
// Esto garantiza que la DB de producción esté siempre actualizada aunque
// el `prisma migrate` haya fallado en el contenedor Docker.
if (!globalForPrisma.hasCheckedSchema) {
  globalForPrisma.hasCheckedSchema = true;
  (async () => {
    // ── Columnas nuevas en customers ──────────────────────────────────────
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "customers" ADD COLUMN "dni" TEXT;`);
    } catch {}
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "customers" ADD COLUMN "is_special_wholesale" BOOLEAN DEFAULT 0;`);
    } catch {}
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "customers" ADD COLUMN "customer_type" TEXT DEFAULT 'normal';`);
    } catch {}

    // ── Tabla oauth_accounts ──────────────────────────────────────────────
    // Esta tabla es necesaria para que el login con Google/Facebook/Twitter funcione.
    // Si no existe, el OAuth falla con: "The table main.oauth_accounts does not exist"
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "oauth_accounts" (
          "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
          "customer_id" INTEGER NOT NULL,
          "provider" TEXT NOT NULL,
          "provider_account_id" TEXT NOT NULL,
          CONSTRAINT "oauth_accounts_customer_id_fkey"
            FOREIGN KEY ("customer_id") REFERENCES "customers" ("id")
            ON DELETE CASCADE ON UPDATE CASCADE
        );
      `);
    } catch {}
    try {
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "oauth_accounts_provider_provider_account_id_key"
        ON "oauth_accounts"("provider", "provider_account_id");
      `);
    } catch {}
    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "oauth_accounts_customer_id_idx"
        ON "oauth_accounts"("customer_id");
      `);
    } catch {}

    // ── Tabla cart_items (si no existe) ──────────────────────────────────
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "cart_items" (
          "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
          "user_id" INTEGER,
          "product_id" TEXT NOT NULL,
          "variant_id" TEXT NOT NULL,
          "quantity" INTEGER DEFAULT 1,
          CONSTRAINT "cart_items_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "customers" ("id")
            ON DELETE CASCADE ON UPDATE CASCADE
        );
      `);
    } catch {}

    // ── Tabla orders (si no existe) ───────────────────────────────────────
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "orders" (
          "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
          "order_number" TEXT NOT NULL,
          "customer_id" INTEGER,
          "customer_name" TEXT,
          "customer_email" TEXT,
          "customer_phone" TEXT,
          "items" TEXT NOT NULL DEFAULT '[]',
          "total_ars" REAL NOT NULL DEFAULT 0,
          "payment_method" TEXT,
          "payment_status" TEXT NOT NULL DEFAULT 'pending',
          "order_status" TEXT NOT NULL DEFAULT 'pending',
          "shipping_address" TEXT,
          "notes" TEXT,
          "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch {}
    try {
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "orders_order_number_key" ON "orders"("order_number");
      `);
    } catch {}

  })().catch((e) => {
    console.error('[prisma.ts] Error en auto-migración:', e?.message ?? e);
  });
}

