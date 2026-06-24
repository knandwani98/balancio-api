import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

/** In dev, a new client per import; save this file after `prisma generate` to reload. */
export const prisma =
  process.env.NODE_ENV === "production"
    ? (globalForPrisma.prisma ?? new PrismaClient())
    : new PrismaClient();

if (process.env.NODE_ENV === "production") {
  globalForPrisma.prisma = prisma;
}
