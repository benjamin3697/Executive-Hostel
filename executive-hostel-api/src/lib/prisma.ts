import { PrismaClient } from "@prisma/client";

// A single shared Prisma instance. In dev with hot-reload (tsx watch),
// stash it on globalThis so we don't open a new connection pool per reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
