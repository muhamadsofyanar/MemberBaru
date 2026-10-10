import { db, PRISMA_SERIALIZABLE } from "./db";
import type {
  Product,
  ProductType,
  ProductStatus,
  OrderItemSource,
  GrantKind,
  DiscountType,
} from "@prisma/client";
import { roundDiscountAllocation, allocateCommission, expiryDefaultHours } from "./business";
import { isConflict } from "./db";

export type BuildOrderInput = {
  userId: string;
  productMainId: string;
  bumpOfferId?: string;
  couponCode?: string;
  idempotencyKey?: string;
};

export type LineItem = {
  source: OrderItemSource;
  productId: string | null;
  productSnapshotName: string;
  productSnapshotType: ProductType;
  price: number;
  affiliatePercent: number;
  grantRefs: GrantRef[];
};

export type GrantRef = {
  kind: GrantKind;
  grantRefId: string;
  snapshotName: string;
  durationDays?: number | null;
  productId?: string | null;
};

export type BuildOrderPreview = {
  items: Array<{
    source: OrderItemSource;
    name: string;
    type: ProductType;
    price: number;
    discount: number;
    netPrice: number;
    affiliatePercent: number;
    commission: number;
  }>;
  subtotal: number;
  discountTotal: number;
  amount: number;
  commissionTotal: number;
  couponApplied?: { code: string; type: DiscountType; value: number } | null;
  couponError?: string | null;
  expiresAt?: Date;
};

function toUtcNow() {
  return new Date();
}

function productPublished(p: Pick<Product, "id" | "status">): boolean {
  return p.status === ("PUBLISHED");
}

async function loadMainProduct(id: string) {
  return db.product.findUnique({
    where: { id },
    include: {
      assets: { orderBy: { createdAt: "desc" } },
      course: true,
      plan: true,
      bundleOf: { include: { component: true } },
      bumps: true,
    },
  });
}

async function loadBumpOffer(id: string) {
  return db.product.findUnique({
    where: { id },
    include: {
      assets: true,
      course: true,
      plan: true,
      bundleOf: { include: { component: true } },
    },
  });
}

function pushRefsForProduct(
  acc: GrantRef[],
  p: {
    id: string;
    type: ProductType;
    name: string;
    legacyPlanId?: string | null;
    plan?: { id: string; name: string; durationDays: number } | null;
    courseId?: string | null;
    course?: { id: string; title: string } | null;
    assets?: Array<{ id: string; originalName: string }>;
    bundleOf?: Array<{ component?: { id: string; type: ProductType; name: string; legacyPlanId?: string | null; courseId?: string | null; plan?: { id: string; name: string; durationDays: number } | null; course?: { id: string; title: string } | null; assets?: Array<{ id: string; originalName: string }> } | null }>;
  },
  planSeen: Set<string>,
  dedupSeen: Set<string>,
  allowDuplicateCourseAsset = false,
): void {
  if (p.type === ("EBOOK") || p.type === ("TEMPLATE")) {
    for (const a of p.assets || []) {
      const key = `ASSET:${a.id}`;
      if (!allowDuplicateCourseAsset && dedupSeen.has(key)) continue;
      dedupSeen.add(key);
      acc.push({
        kind: "ASSET",
        grantRefId: a.id,
        snapshotName: a.originalName || p.name,
        productId: p.id,
      });
    }
  } else if (p.type === "COURSE") {
    if (p.courseId && p.course) {
      const key = `COURSE:${p.courseId}`;
      if (!allowDuplicateCourseAsset && dedupSeen.has(key)) return;
      dedupSeen.add(key);
      acc.push({
        kind: "COURSE",
        grantRefId: p.courseId,
        snapshotName: p.course.title,
        productId: p.id,
      });
    }
  } else if (p.type === "MEMBERSHIP") {
    if (p.legacyPlanId && p.plan) {
      const key = `PLAN:${p.legacyPlanId}`;
      if (planSeen.has(key)) {
        throw new Error("Tidak dapat membeli paket (Plan) yang sama dua kali dalam satu order. Pilih hanya satu produk yang memberikan paket ini.");
      }
      planSeen.add(key);
      acc.push({
        kind: "PLAN",
        grantRefId: p.legacyPlanId,
        snapshotName: p.plan.name,
        durationDays: p.plan.durationDays,
        productId: p.id,
      });
    }
  } else if (p.type === "BUNDLE") {
    for (const bc of p.bundleOf || []) {
      if (!bc.component) continue;
      if (bc.component.type === "BUNDLE") {
        throw new Error("Bundel tidak valid: anggota tidak boleh berupa bundel lain.");
      }
      pushRefsForProduct(
        acc,
        bc.component,
        planSeen,
        dedupSeen,
        allowDuplicateCourseAsset,
      );
    }
  }
}

async function validateCoupon(
  codeRaw: string | undefined,
  mainProductId: string,
  subtotal: number,
  currentUsedOrReserved: number,
): Promise<{
  discountTotal: number;
  applied: { id: string; code: string; type: DiscountType; value: number } | null;
  error?: string;
}> {
  if (!codeRaw) return { discountTotal: 0, applied: null };
  const code = codeRaw.trim().toUpperCase();
  if (!code) return { discountTotal: 0, applied: null };
  const coupon = await db.coupon.findUnique({
    where: { code },
    include: { products: { select: { productId: true } } },
  });
  if (!coupon) return { discountTotal: 0, applied: null, error: "Kupon tidak ditemukan." };
  const now = new Date();
  if (!coupon.active) return { discountTotal: 0, applied: null, error: "Kupon tidak aktif." };
  if (coupon.startAt && coupon.startAt > now) return { discountTotal: 0, applied: null, error: "Kupon belum berlaku." };
  if (coupon.endAt && coupon.endAt <= now) return { discountTotal: 0, applied: null, error: "Kupon sudah kedaluwarsa." };
  if (coupon.products && coupon.products.length > 0) {
    const allowed = new Set(coupon.products.map(r => r.productId));
    if (!allowed.has(mainProductId)) {
      return { discountTotal: 0, applied: null, error: "Kupon tidak berlaku untuk produk ini." };
    }
  }
  if (coupon.maxUses != null) {
    if (currentUsedOrReserved + 1 > coupon.maxUses) {
      return { discountTotal: 0, applied: null, error: "Kuota kupon sudah habis." };
    }
  }
  let disc = 0;
  if (coupon.type === "PERCENT") {
    disc = Math.floor((subtotal * coupon.value) / 100);
  } else {
    disc = Math.min(subtotal - 1, coupon.value);
  }
  if (disc < 0) disc = 0;
  if (subtotal - disc < 1) disc = Math.max(0, subtotal - 1);
  return {
    discountTotal: disc,
    applied: { id: coupon.id, code: coupon.code, type: coupon.type, value: coupon.value },
  };
}

async function couponCurrentUsedOrReserved(couponId: string): Promise<number> {
  const used = await db.couponReservation.count({
    where: {
      couponId,
      OR: [
        { usedAt: { not: null } },
        {
          order: {
            status: { in: ["PENDING", "PAID"] as any },
          },
        },
      ],
    },
  });
  return used;
}

export async function buildOrderPreview(input: BuildOrderInput): Promise<BuildOrderPreview> {
  if (!input.userId) throw new Error("Login diperlukan.");
  const main = await loadMainProduct(input.productMainId);
  if (!main) throw new Error("Produk tidak ditemukan.");
  if (!productPublished(main)) throw new Error("Produk belum tersedia untuk dibeli.");

  let bumpOffer: Awaited<ReturnType<typeof loadBumpOffer>> = null;
  if (input.bumpOfferId) {
    const hasBumpConfig = (main.bumps || []).some(b => b.bumpOfferId === input.bumpOfferId);
    if (!hasBumpConfig) throw new Error("Penawaran bump tidak berlaku untuk produk ini.");
    bumpOffer = await loadBumpOffer(input.bumpOfferId);
    if (!bumpOffer || !productPublished(bumpOffer)) {
      throw new Error("Penawaran bump tidak tersedia.");
    }
    if (bumpOffer.type === "BUNDLE") {
      throw new Error("Bump tidak boleh berupa bundel.");
    }
  }

  const planSeen = new Set<string>();
  const dedupSeen = new Set<string>();
  const mainRefs: GrantRef[] = [];
  pushRefsForProduct(mainRefs, main, planSeen, dedupSeen, false);
  const mainLine: LineItem = {
    source: "MAIN",
    productId: main.id,
    productSnapshotName: main.name,
    productSnapshotType: main.type,
    price: main.price,
    affiliatePercent: main.affiliatePercent,
    grantRefs: mainRefs,
  };
  const lines: LineItem[] = [mainLine];

  if (bumpOffer) {
    const bumpRefs: GrantRef[] = [];
    pushRefsForProduct(bumpRefs, bumpOffer, planSeen, dedupSeen, false);
    lines.push({
      source: "BUMP",
      productId: bumpOffer.id,
      productSnapshotName: bumpOffer.name,
      productSnapshotType: bumpOffer.type,
      price: bumpOffer.price,
      affiliatePercent: bumpOffer.affiliatePercent,
      grantRefs: bumpRefs,
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.price, 0);

  const couponCode = input.couponCode?.trim();
  let couponReservationCouponId: string | null = null;
  if (couponCode) {
    const tmpCode = couponCode.toUpperCase();
    const c = await db.coupon.findUnique({ where: { code: tmpCode } });
    if (c) couponReservationCouponId = c.id;
  }
  const reservedOrUsed = couponReservationCouponId
    ? await couponCurrentUsedOrReserved(couponReservationCouponId)
    : 0;
  const coupon = await validateCoupon(couponCode, main.id, subtotal, reservedOrUsed);

  const alloc = roundDiscountAllocation(
    lines.map((l, i) => ({ index: i, subtotalPrice: l.price })),
    coupon.discountTotal,
  );
  const byIndex = new Map(alloc.map(a => [a.index, a]));
  const itemsOut = lines.map((l, i) => {
    const a = byIndex.get(i)!;
    const commission = allocateCommission(a.netPrice, l.affiliatePercent);
    return {
      source: l.source,
      name: l.productSnapshotName,
      type: l.productSnapshotType,
      price: l.price,
      discount: a.discount,
      netPrice: a.netPrice,
      affiliatePercent: l.affiliatePercent,
      commission,
      _line: l,
    };
  });

  const discountTotal = itemsOut.reduce((s, r) => s + r.discount, 0);
  const amount = itemsOut.reduce((s, r) => s + r.netPrice, 0);
  const commissionTotal = itemsOut.reduce((s, r) => s + r.commission, 0);
  const hours = await expiryDefaultHours();
  const expiresAt = new Date(Date.now() + hours * 3600 * 1000);

  return {
    items: itemsOut.map(({ _line: _ign, ...rest }) => rest),
    subtotal,
    discountTotal,
    amount,
    commissionTotal,
    couponApplied: coupon.applied,
    couponError: coupon.error || null,
    expiresAt,
  };
}

export async function buildAndSaveOrder(input: BuildOrderInput) {
  const MAX_RETRY = 3;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < MAX_RETRY; attempt += 1) {
    try {
      return await db.$transaction(
        async tx => {
          if (input.idempotencyKey) {
            const existing = await tx.order.findUnique({
              where: { idempotencyKey: input.idempotencyKey },
              select: {
                id: true,
                invoice: true,
                amount: true,
                status: true,
                createdAt: true,
                expiresAt: true,
              },
            });
            if (existing) return { created: false, order: existing };
          }
          const user = await tx.user.findUnique({
            where: { id: input.userId },
            select: { id: true, isActive: true },
          });
          if (!user) throw new Error("Akun tidak ditemukan.");
          if (!user.isActive) throw new Error("Akun dinonaktifkan.");

          const main = await tx.product.findUnique({
            where: { id: input.productMainId },
            include: {
              assets: { orderBy: { createdAt: "desc" } },
              course: true,
              plan: true,
              bundleOf: { include: { component: true } },
              bumps: true,
            },
          });
          if (!main) throw new Error("Produk tidak ditemukan.");
          if (main.status !== "PUBLISHED") {
            throw new Error("Produk tidak tersedia untuk dibeli.");
          }

          let bumpOffer: {
            id: string; type: any; name: string; price: number; affiliatePercent: number; status: any;
            legacyPlanId?: string | null; plan?: any; courseId?: string | null; course?: any;
            assets?: any; bundleOf?: any;
          } | null = null;
          if (input.bumpOfferId) {
            const hasBump = (main.bumps || []).some(b => b.bumpOfferId === input.bumpOfferId);
            if (!hasBump) throw new Error("Penawaran bump tidak berlaku untuk produk ini.");
            bumpOffer = await tx.product.findUnique({
              where: { id: input.bumpOfferId },
              include: {
                assets: true,
                course: true,
                plan: true,
                bundleOf: { include: { component: true } },
                bumps: true,
              },
            });
            if (!bumpOffer || bumpOffer.status !== "PUBLISHED") {
              throw new Error("Penawaran bump tidak tersedia.");
            }
            if (bumpOffer.type === "BUNDLE") {
              throw new Error("Bump tidak boleh berupa bundel.");
            }
          }

          const planSeen = new Set<string>();
          const dedupSeen = new Set<string>();
          const mainRefs: GrantRef[] = [];
          pushRefsForProduct(mainRefs, main, planSeen, dedupSeen, false);
          const lines: LineItem[] = [
            {
              source: "MAIN",
              productId: main.id,
              productSnapshotName: main.name,
              productSnapshotType: main.type,
              price: main.price,
              affiliatePercent: main.affiliatePercent,
              grantRefs: mainRefs,
            },
          ];
          if (bumpOffer) {
            const bumpRefs: GrantRef[] = [];
            pushRefsForProduct(bumpRefs, bumpOffer as any, planSeen, dedupSeen, false);
            lines.push({
              source: "BUMP",
              productId: bumpOffer.id,
              productSnapshotName: bumpOffer.name,
              productSnapshotType: (bumpOffer as any).type,
              price: bumpOffer.price,
              affiliatePercent: bumpOffer.affiliatePercent,
              grantRefs: bumpRefs,
            });
          }
          const subtotal = lines.reduce((s, l) => s + l.price, 0);

          let couponAppliedId: string | null = null;
          let coupon: Awaited<ReturnType<typeof validateCoupon>> = { discountTotal: 0, applied: null };
          if (input.couponCode) {
            const codeUp = input.couponCode.trim().toUpperCase();
            const row = await tx.coupon.findUnique({
              where: { code: codeUp },
              include: { products: { select: { productId: true } } },
            });
            if (row) {
              const usedOrReserved = await tx.couponReservation.count({
                where: {
                  couponId: row.id,
                  OR: [{ usedAt: { not: null } }, { order: { status: { in: ["PENDING", "PAID"] as any } } }],
                },
              });
              const now = new Date();
              if (row.active && (!row.startAt || row.startAt <= now) && (!row.endAt || row.endAt > now)) {
                let productOk = true;
                if (row.products && row.products.length > 0) {
                  const allowed = new Set(row.products.map(r => r.productId));
                  productOk = allowed.has(main.id);
                }
                let withinQuota = true;
                if (row.maxUses != null && usedOrReserved + 1 > row.maxUses) withinQuota = false;
                if (productOk && withinQuota) {
                  let disc = 0;
                  if (row.type === "PERCENT") disc = Math.floor((subtotal * row.value) / 100);
                  else disc = Math.min(subtotal - 1, row.value);
                  if (disc < 0) disc = 0;
                  if (subtotal - disc < 1) disc = Math.max(0, subtotal - 1);
                  coupon = {
                    discountTotal: disc,
                    applied: { id: row.id, code: row.code, type: row.type, value: row.value },
                  };
                  couponAppliedId = row.id;
                }
              }
            }
          }

          const alloc = roundDiscountAllocation(
            lines.map((l, i) => ({ index: i, subtotalPrice: l.price })),
            coupon.discountTotal,
          );
          const byIndex = new Map(alloc.map(a => [a.index, a]));
          const invoice =
            "INV-" +
            new Date().getFullYear().toString().slice(-2) +
            (new Date().getMonth() + 1).toString().padStart(2, "0") +
            Math.random().toString(36).slice(2, 8).toUpperCase();
          const hours = await expiryDefaultHours();
          const expiresAt = new Date(Date.now() + hours * 3600 * 1000);
          const finalAmount = lines.reduce((s, l, i) => s + byIndex.get(i)!.netPrice, 0);

          const order = await tx.order.create({
            data: {
              userId: input.userId,
              invoice,
              planId: null,
              amount: finalAmount,
              subtotal,
              discountTotal: coupon.discountTotal,
              status: "PENDING",
              expiresAt,
              legacy: false,
              idempotencyKey: input.idempotencyKey || null,
            },
            select: {
              id: true,
              invoice: true,
              amount: true,
              status: true,
              createdAt: true,
              expiresAt: true,
            },
          });
          if (couponAppliedId) {
            await tx.couponReservation.create({
              data: { couponId: couponAppliedId, orderId: order.id },
            });
          }
          for (let i = 0; i < lines.length; i += 1) {
            const l = lines[i];
            const a = byIndex.get(i)!;
            const item = await tx.orderItem.create({
              data: {
                orderId: order.id,
                source: l.source,
                productSnapshotName: l.productSnapshotName,
                productSnapshotType: l.productSnapshotType,
                productId: l.productId,
                price: l.price,
                discount: a.discount,
                netPrice: a.netPrice,
                affiliatePercent: l.affiliatePercent,
              },
              select: { id: true },
            });
            for (const g of l.grantRefs) {
              await tx.orderGrant.create({
                data: {
                  orderId: order.id,
                  orderItemId: item.id,
                  kind: g.kind,
                  grantRefId: g.grantRefId,
                  snapshotName: g.snapshotName,
                  durationDays: g.durationDays ?? null,
                  productId: g.productId ?? null,
                },
              });
            }
          }
          return { created: true, order };
        },
        PRISMA_SERIALIZABLE,
      );
    } catch (err: any) {
      if (isConflict(err)) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("Sistem sedang sibuk, coba lagi beberapa saat lagi.");
}

