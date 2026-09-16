import { PrismaClient } from "@prisma/client";

// Next.js dev's hot reload re-evaluates this module on every edit without
// restarting the process; caching the client on `globalThis` means those
// reloads reuse one connection pool instead of opening a new one each time.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
