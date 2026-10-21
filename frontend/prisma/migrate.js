const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function runMigrations() {
  console.log('🔄 [DB MIGRATION] Verificando esquema de base de datos...');

  // 1. Tabla site_settings
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "site_settings" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "key" TEXT NOT NULL,
        "value" TEXT NOT NULL
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "site_settings_key_key" ON "site_settings"("key");
    `);
    console.log('✅ [DB MIGRATION] Tabla "site_settings" verificada/creada.');
  } catch (err) {
    console.warn('⚠️ [DB MIGRATION] Error en tabla "site_settings":', err.message);
  }

  // 2. Tabla provinces
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "provinces" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "name" TEXT NOT NULL
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "provinces_name_key" ON "provinces"("name");
    `);
  } catch (err) {
    console.warn('⚠️ [DB MIGRATION] Error en tabla "provinces":', err.message);
  }

  // 3. Tabla cities
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "cities" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "province_id" INTEGER,
        "name" TEXT,
        "postal_code" TEXT,
        CONSTRAINT "cities_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces" ("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "cities_name_idx" ON "cities"("name");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "cities_province_id_idx" ON "cities"("province_id");
    `);
  } catch (err) {
    console.warn('⚠️ [DB MIGRATION] Error en tabla "cities":', err.message);
  }

  // 4. Tabla admins
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "admins" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "email" TEXT NOT NULL,
        "password_hash" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "role" TEXT DEFAULT 'admin'
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "admins_email_key" ON "admins"("email");
    `);
  } catch (err) {
    console.warn('⚠️ [DB MIGRATION] Error en tabla "admins":', err.message);
  }

  // 5. Tabla customers & columnas
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "customers" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "email" TEXT NOT NULL,
        "password_hash" TEXT DEFAULT '',
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
      CREATE UNIQUE INDEX IF NOT EXISTS "customers_email_key" ON "customers"("email");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "customers_phone_key" ON "customers"("phone");
    `);

    const tableInfo = await prisma.$queryRawUnsafe(`PRAGMA table_info(customers);`);
    const existingCols = new Set(Array.isArray(tableInfo) ? tableInfo.map(c => c.name) : []);

    const newCols = [
      { name: 'dni', type: 'TEXT' },
      { name: 'is_special_wholesale', type: 'BOOLEAN DEFAULT 0' },
      { name: 'customer_type', type: "TEXT DEFAULT 'normal'" },
      { name: 'wholesale_until', type: 'DATETIME' },
      { name: 'is_wholesale', type: 'BOOLEAN DEFAULT 0' },
      { name: 'email_verified', type: 'BOOLEAN DEFAULT 0' },
      { name: 'is_approved', type: 'BOOLEAN DEFAULT 0' },
      { name: 'verification_token', type: 'TEXT' },
      { name: 'address', type: 'TEXT' },
      { name: 'province', type: 'TEXT' },
      { name: 'city', type: 'TEXT' },
      { name: 'postal_code', type: 'TEXT' },
    ];

    for (const col of newCols) {
      if (!existingCols.has(col.name)) {
        await prisma.$executeRawUnsafe(`ALTER TABLE "customers" ADD COLUMN "${col.name}" ${col.type};`);
        console.log(`✅ [DB MIGRATION] Columna "${col.name}" agregada a "customers".`);
      }
    }
  } catch (err) {
    console.warn('⚠️ [DB MIGRATION] Advertencia verificando columnas en customers:', err.message);
  }

  // 5.2 Permitir NULL en phone y password_hash (necesario para OAuth y usuarios sin teléfono)
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

  // 6. Tabla oauth_accounts
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

  // 7. Tabla cart_items
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "cart_items" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "user_id" INTEGER,
        "product_id" TEXT NOT NULL,
        "variant_id" TEXT NOT NULL,
        "quantity" INTEGER DEFAULT 1,
        CONSTRAINT "cart_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "cart_items_user_id_idx" ON "cart_items"("user_id");
    `);
  } catch (err) {
    console.warn('⚠️ [DB MIGRATION] Error en tabla "cart_items":', err.message);
  }

  // 8. Tabla orders & columnas
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "orders" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "user_id" INTEGER,
        "order_number" TEXT NOT NULL,
        "status" TEXT DEFAULT 'En revisión',
        "payment_status" TEXT DEFAULT 'pending',
        "delivery_status" TEXT DEFAULT 'pending',
        "total" REAL DEFAULT 0,
        "paid_amount" REAL DEFAULT 0,
        "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
        "admin_notes" TEXT,
        "payment_type" TEXT DEFAULT 'total',
        "installments_count" INTEGER DEFAULT 1,
        "last_installment_paid_month" TEXT,
        "shipping_type" TEXT DEFAULT 'delivery',
        "shipping_cost" REAL DEFAULT 0,
        "shipping_tracking_number" TEXT,
        "shipping_invoice_url" TEXT,
        "shipped_at" TEXT,
        CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "orders_order_number_key" ON "orders"("order_number");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "orders_user_id_idx" ON "orders"("user_id");
    `);

    const orderCols = await prisma.$queryRawUnsafe(`PRAGMA table_info(orders);`);
    const existingOrderCols = new Set(Array.isArray(orderCols) ? orderCols.map(c => c.name) : []);

    const newOrderCols = [
      { name: 'shipping_type', type: "TEXT DEFAULT 'delivery'" },
      { name: 'shipping_cost', type: 'REAL DEFAULT 0' },
      { name: 'shipping_tracking_number', type: 'TEXT' },
      { name: 'shipping_invoice_url', type: 'TEXT' },
      { name: 'shipped_at', type: 'TEXT' },
      { name: 'payment_type', type: "TEXT DEFAULT 'total'" },
      { name: 'installments_count', type: 'INTEGER DEFAULT 1' },
      { name: 'last_installment_paid_month', type: 'TEXT' },
      { name: 'paid_amount', type: 'REAL DEFAULT 0' },
      { name: 'admin_notes', type: 'TEXT' },
    ];

    for (const col of newOrderCols) {
      if (!existingOrderCols.has(col.name)) {
        await prisma.$executeRawUnsafe(`ALTER TABLE "orders" ADD COLUMN "${col.name}" ${col.type};`);
        console.log(`✅ [DB MIGRATION] Columna "${col.name}" agregada a "orders".`);
      }
    }
  } catch (err) {
    console.warn('⚠️ [DB MIGRATION] Error en tabla "orders":', err.message);
  }

  // 9. Tabla order_items
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "order_items" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "order_id" INTEGER,
        "product_id" TEXT NOT NULL,
        "variant_id" TEXT NOT NULL,
        "quantity" INTEGER DEFAULT 1,
        "price" REAL DEFAULT 0,
        "product_name" TEXT,
        "variant_info" TEXT,
        "image_url" TEXT,
        CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "order_items_order_id_idx" ON "order_items"("order_id");
    `);
  } catch (err) {
    console.warn('⚠️ [DB MIGRATION] Error en tabla "order_items":', err.message);
  }

  // 10. Proveedores y lotes de compra
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "suppliers" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "name" TEXT NOT NULL,
        "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_name_key" ON "suppliers"("name");
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "purchase_batches" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "batch_number" TEXT,
        "supplier_id" INTEGER,
        "purchase_date" DATETIME,
        "currency" TEXT DEFAULT 'ARS',
        "exchange_rate" REAL DEFAULT 1.0,
        "shipping_currency" TEXT DEFAULT 'ARS',
        "shipping_cost_original" REAL DEFAULT 0.0,
        "shipping_cost_ars" REAL DEFAULT 0.0,
        "total_products_ars" REAL DEFAULT 0.0,
        "total_cost_ars" REAL DEFAULT 0.0,
        "notes" TEXT,
        "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "purchase_batches_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "purchase_batches_batch_number_key" ON "purchase_batches"("batch_number");
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "purchase_batch_items" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "batch_id" INTEGER NOT NULL,
        "product_id" TEXT NOT NULL,
        "variant_id" TEXT NOT NULL,
        "product_name" TEXT,
        "variant_label" TEXT,
        "quantity" INTEGER DEFAULT 1,
        "unit_cost_original" REAL DEFAULT 0.0,
        "unit_cost_ars" REAL DEFAULT 0.0,
        "shipping_per_unit_ars" REAL DEFAULT 0.0,
        "total_cost_per_unit_ars" REAL DEFAULT 0.0,
        "sale_price" REAL DEFAULT 0.0,
        CONSTRAINT "purchase_batch_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "purchase_batches" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "purchase_batch_items_batch_id_idx" ON "purchase_batch_items"("batch_id");
    `);
  } catch (err) {
    console.warn('⚠️ [DB MIGRATION] Error en tablas de compras/proveedores:', err.message);
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
