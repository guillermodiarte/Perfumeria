const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function runMigrations() {
  console.log('🔄 [DB MIGRATION] Verificando esquema de base de datos...');

  // 1. Agregar columna dni a customers si no existe
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "customers" ADD COLUMN "dni" TEXT;`);
    console.log('✅ [DB MIGRATION] Columna "dni" agregada exitosamente a la tabla "customers".');
  } catch (err) {
    // Si la columna ya existe en SQLite, arroja error tipo "duplicate column name: dni"
    console.log('ℹ️ [DB MIGRATION] Columna "dni" ya presente en "customers".');
  }

  // 2. Crear tabla oauth_accounts si no existe
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "oauth_accounts" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "customer_id" INTEGER NOT NULL,
        "provider" TEXT NOT NULL,
        "provider_account_id" TEXT NOT NULL,
        CONSTRAINT "oauth_accounts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "oauth_accounts_provider_provider_account_id_key" 
      ON "oauth_accounts"("provider", "provider_account_id");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "oauth_accounts_customer_id_idx" 
      ON "oauth_accounts"("customer_id");
    `);
    console.log('✅ [DB MIGRATION] Tabla "oauth_accounts" e índices verificados/creados.');
  } catch (err) {
    console.warn('⚠️ [DB MIGRATION] Advertencia en tabla "oauth_accounts":', err.message);
  }

  console.log('🎉 [DB MIGRATION] Base de datos sincronizada con éxito.');
}

runMigrations()
  .catch((err) => {
    console.error('❌ [DB MIGRATION] Error durante la migración:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
