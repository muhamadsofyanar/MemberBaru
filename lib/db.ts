import { PrismaClient, Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

const SERIAL_FAILURE_CODES = new Set(["P2034", "40001"]);

export function isConflict(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string };
  if ("code" in e && typeof e.code === "string") {
    if (SERIAL_FAILURE_CODES.has(e.code)) return true;
    if ((e as any).name === "Transaction rolled back due to a write conflict or deadlock.") return true;
  }
  const msg = err instanceof Error ? err.message + " " + ((err as any).stack || "") : String(err);
  if (/serialization|deadlock|could not serialize|P2034|40001/i.test(msg)) return true;
  return false;
}

export const PRISMA_SERIALIZABLE = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const;


