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

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Auto-verificación de columnas esenciales para SQLite
if (!globalForPrisma.hasCheckedSchema) {
  globalForPrisma.hasCheckedSchema = true;
  (async () => {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "customers" ADD COLUMN "dni" TEXT;`);
    } catch {}
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "customers" ADD COLUMN "is_special_wholesale" BOOLEAN DEFAULT 0;`);
    } catch {}
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "customers" ADD COLUMN "customer_type" TEXT DEFAULT 'normal';`);
    } catch {}
  })().catch(() => {});
}
