const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function runMigrations() {
  console.log('🔄 [DB MIGRATION] Verificando esquema de base de datos...');

  // 1. Agregar columnas a customers si no existen
  try {
    const tableInfo = await prisma.$queryRawUnsafe(`PRAGMA table_info(customers);`);
    const existingCols = new Set(Array.isArray(tableInfo) ? tableInfo.map(c => c.name) : []);

    if (!existingCols.has('dni')) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "customers" ADD COLUMN "dni" TEXT;`);
      console.log('✅ [DB MIGRATION] Columna "dni" agregada a "customers".');
    }

    if (!existingCols.has('is_special_wholesale')) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "customers" ADD COLUMN "is_special_wholesale" BOOLEAN DEFAULT 0;`);
      console.log('✅ [DB MIGRATION] Columna "is_special_wholesale" agregada a "customers".');
    }

    if (!existingCols.has('customer_type')) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "customers" ADD COLUMN "customer_type" TEXT DEFAULT 'normal';`);
      console.log('✅ [DB MIGRATION] Columna "customer_type" agregada a "customers".');
    }
  } catch (err) {
    console.warn('⚠️ [DB MIGRATION] Advertencia verificando columnas en customers:', err.message);
  }

  // 1.2 Permitir NULL en phone y password_hash (necesario para OAuth y usuarios sin teléfono)
  try {
    const tableInfo = await prisma.$queryRawUnsafe(`PRAGMA table_info(customers);`);
    const phoneCol = Array.isArray(tableInfo) ? tableInfo.find(c => c.name === 'phone') : null;
    if (phoneCol && phoneCol.notnull === 1) {
      console.log('🔄 [DB MIGRATION] Modificando tabla customers para permitir phone nulo (OAuth)...');
      await prisma.$executeRawUnsafe(`PRAGMA foreign_keys=off;`);
      await prisma.$executeRawUnsafe(`BEGIN TRANSACTION;`);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "customers_new" (
          "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
          "email" TEXT NOT NULL,
          "password_hash" TEXT,
          "name" TEXT NOT NULL,
          "phone" TEXT,
          "address" TEXT,
          "province" TEXT,
          "city" TEXT,
          "postal_code" TEXT,
          "email_verified" BOOLEAN DEFAULT false,
          "verification_token" TEXT,
          "is_approved" BOOLEAN DEFAULT false,
          "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
          "is_wholesale" BOOLEAN DEFAULT false,
          "wholesale_until" DATETIME,
          "dni" TEXT,
          "is_special_wholesale" BOOLEAN DEFAULT 0,
          "customer_type" TEXT DEFAULT 'normal'
        );
      `);
      await prisma.$executeRawUnsafe(`
        INSERT INTO "customers_new" (
          id, email, password_hash, name, phone, address, province, city, postal_code,
          email_verified, verification_token, is_approved, created_at, is_wholesale, wholesale_until,
          dni, is_special_wholesale, customer_type
        )
        SELECT 
          id, email, password_hash, name, phone, address, province, city, postal_code,
          email_verified, verification_token, is_approved, created_at, is_wholesale, wholesale_until,
          dni, is_special_wholesale, customer_type
        FROM "customers";
      `);
      await prisma.$executeRawUnsafe(`DROP TABLE "customers";`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "customers_new" RENAME TO "customers";`);
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "customers_email_key" ON "customers"("email");`);
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "customers_phone_key" ON "customers"("phone");`);
      await prisma.$executeRawUnsafe(`COMMIT;`);
      await prisma.$executeRawUnsafe(`PRAGMA foreign_keys=on;`);
      console.log('✅ [DB MIGRATION] Columna phone modificada con éxito para permitir NULL.');
    }
  } catch (err) {
    console.warn('⚠️ [DB MIGRATION] Advertencia al ajustar restricción de phone:', err.message);
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
