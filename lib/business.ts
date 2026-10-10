import { z } from "zod";
import { db } from "./db";
export const passwordSchema = z.string().min(8, "Password minimal 8 karakter.").refine(v => new TextEncoder().encode(v).length <= 72, "Password maksimal 72 byte.");
export function membershipWindow(now: Date, days: number, previousEnd?: Date | null) {
  if (!Number.isInteger(days) || days < 1 || days > 36500) throw new Error("Durasi tidak valid.");
  const startsAt = previousEnd && previousEnd > now ? previousEnd : now;
  return { startsAt, endsAt: new Date(startsAt.getTime() + days * 86400000) };
}
export function payoutTransition(from: string, to: string) {
  return (from === "PENDING" && ["APPROVED", "REJECTED"].includes(to)) || (from === "APPROVED" && ["PAID", "REJECTED"].includes(to));
}
export const activeMembership = (userId: string) => ({userId, status: "ACTIVE" as const, startsAt: {lte: new Date()}, endsAt: {gt: new Date()}});

export type SubtotalItem = { index: number; subtotalPrice: number };
export type AllocationItem = { index: number; subtotalPrice: number; discount: number; netPrice: number };

export function roundDiscountAllocation(items: SubtotalItem[], discountTotal: number): AllocationItem[] {
  if (!Number.isInteger(discountTotal) || discountTotal < 0) throw new Error("Discount tidak valid.");
  if (items.length === 0) return [];
  const subtotalSum = items.reduce((a, b) => a + b.subtotalPrice, 0);
  if (subtotalSum <= 0) throw new Error("Subtotal tidak valid.");
  if (discountTotal > subtotalSum - 1) {
    throw new Error("Diskon maksimal adalah subtotal - Rp1. Minimal order Rp1 setelah diskon.");
  }
  let allocated = 0;
  const result = items.map(it => {
    const share = subtotalSum === 0 ? 0 : Math.floor((it.subtotalPrice * discountTotal) / subtotalSum);
    allocated += share;
    return { index: it.index, subtotalPrice: it.subtotalPrice, discount: share, netPrice: it.subtotalPrice - share };
  });
  let remainder = discountTotal - allocated;
  if (remainder < 0) remainder = 0;
  let i = 0;
  while (remainder > 0 && i < result.length * 2) {
    const idx = i % result.length;
    if (result[idx].netPrice > 1) {
      result[idx].discount += 1;
      result[idx].netPrice -= 1;
      remainder -= 1;
    }
    i += 1;
  }
  const totalNet = result.reduce((s, r) => s + r.netPrice, 0);
  if (totalNet < 1) throw new Error("Total setelah diskon minimal Rp1.");
  return result;
}

export function allocateCommission(netPrice: number, percent: number): number {
  if (!Number.isFinite(netPrice) || netPrice < 0) throw new Error("Net price tidak valid");
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error("Percent tidak valid (0..100)");
  return Math.floor((netPrice * percent) / 100);
}

export async function expiryDefaultHours(): Promise<number> {
  try {
    const row = await db.setting.findUnique({ where: { key: "order_expiry_hours" } });
    if (!row) return 24;
    const n = Number(row.value);
    if (!Number.isFinite(n) || n < 1 || n > 720) return 24;
    return Math.floor(n);
  } catch {
    return 24;
  }
}

