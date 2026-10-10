import { db } from "./db";
import type { ProductType, ProductStatus } from "@prisma/client";

export const PRODUCT_ASSET_REQUIRED: ReadonlySet<ProductType> = new Set<ProductType>([
  "EBOOK",
  "TEMPLATE",
]);

export async function validateProductForPublish(productId: string): Promise<void> {
  const p = await db.product.findUnique({
    where: { id: productId },
    include: {
      assets: true,
      course: true,
      plan: true,
      bundleOf: { include: { component: true } },
    },
  });
  if (!p) throw new Error("Produk tidak ditemukan");
  if (p.type === "EBOOK" || p.type === "TEMPLATE") {
    if (!p.assets || p.assets.length === 0) {
      const kind = p.type === "EBOOK" ? "file EBOOK" : "file ZIP TEMPLATE";
      throw new Error(`Unggah ${kind} terlebih dahulu sebelum terbitkan.`);
    }
  }
  if (p.type === "COURSE") {
    if (!p.courseId) {
      throw new Error("Pilih kursus yang akan dijual sebagai produk satuan.");
    }
    if (!p.course) {
      throw new Error("Kursus tidak ditemukan.");
    }
    if (!p.course.isPublished) {
      throw new Error("Kursus harus sudah diterbitkan sebelum produk COURSE dapat dijual.");
    }
  }
  if (p.type === "MEMBERSHIP") {
    if (!p.legacyPlanId) {
      throw new Error("Pilih paket membership (Plan) yang aktif.");
    }
    if (!p.plan) {
      throw new Error("Paket tidak ditemukan.");
    }
    if (!p.plan.isActive) {
      throw new Error("Paket yang dipilih harus aktif sebelum diterbitkan.");
    }
  }
  if (p.type === "BUNDLE") {
    const components = p.bundleOf || [];
    if (components.length < 2) {
      throw new Error("Bundel harus memiliki minimal 2 anggota produk non-bundel yang terbit.");
    }
    for (const c of components) {
      if (!c.component) continue;
      if (c.component.type === "BUNDLE") {
        throw new Error("Anggota bundel tidak boleh berupa bundel lain (tidak bertingkat).");
      }
      if (c.component.status !== "PUBLISHED") {
        throw new Error(`Anggota ${c.component.name} harus status PUBLISHED.`);
      }
    }
    const seen = new Set<string>();
    for (const c of components) {
      if (seen.has(c.componentId)) {
        throw new Error("Anggota bundel tidak boleh berulang.");
      }
      seen.add(c.componentId);
      if (c.componentId === productId) {
        throw new Error("Bundel tidak boleh menunjuk dirinya sendiri.");
      }
    }
  }
  if (p.price < 1) {
    throw new Error("Harga produk minimal Rp1. Order gratis tidak didukung.");
  }
}

export type NormalizeProductInput = {
  name?: string;
  description?: string;
  type?: string;
  price?: number;
  features?: unknown;
  faq?: unknown;
  thumbnail?: string | null;
  affiliatePercent?: number;
  status?: string;
  legacyPlanId?: string | null;
  courseId?: string | null;
  bundleComponentIds?: string[] | null;
  bumpOfferId?: string | null;
};

export function normalizeProductInput(input: NormalizeProductInput): {
  errors: string[];
  data: {
    name: string;
    description: string;
    type: ProductType;
    price: number;
    features: unknown[];
    faq: unknown[];
    thumbnail: string | null;
    affiliatePercent: number;
    status: ProductStatus;
    legacyPlanId: string | null;
    courseId: string | null;
  };
} {
  const errors: string[] = [];
  const name = (input.name || "").trim();
  const description = (input.description || "").trim();
  if (!name) errors.push("Nama produk wajib diisi");
  if (!description) errors.push("Deskripsi produk wajib diisi");
  if (name.length > 120) errors.push("Nama produk maksimal 120 karakter");
  if (description.length > 5000) errors.push("Deskripsi maksimal 5000 karakter");

  let type: ProductType = "EBOOK";
  if (!input.type) {
    errors.push("Pilih jenis produk");
  } else {
    const allowed: ProductType[] = [
      "EBOOK",
      "TEMPLATE",
      "COURSE",
      "MEMBERSHIP",
      "BUNDLE",
    ];
    const t = (input.type as string).toUpperCase() as ProductType;
    if (allowed.includes(t)) type = t;
    else errors.push("Jenis produk tidak valid (EBOOK/TEMPLATE/COURSE/MEMBERSHIP/BUNDLE)");
  }
  const rawPrice = Number(input.price ?? NaN);
  if (!Number.isFinite(rawPrice) || rawPrice < 1) {
    errors.push("Harga minimal Rp1, bilangan bulat rupiah");
  }
  const price = Math.floor(Number.isFinite(rawPrice) ? rawPrice : 0);
  let features: unknown[] = [];
  if (input.features != null) {
    if (Array.isArray(input.features)) features = input.features.slice(0, 50);
    else errors.push("Fitur harus berupa daftar");
  }
  let faq: unknown[] = [];
  if (input.faq != null) {
    if (Array.isArray(input.faq)) faq = input.faq.slice(0, 50);
    else errors.push("FAQ harus berupa daftar {q, a}");
  }
  const thumbnail = input.thumbnail ? String(input.thumbnail).slice(0, 500) : null;
  const rawAff = Number(input.affiliatePercent ?? 20);
  const affiliatePercent = Math.max(0, Math.min(100, Math.floor(Number.isFinite(rawAff) ? rawAff : 20)));
  let status: ProductStatus = "DRAFT";
  if (input.status) {
    const s = (input.status as string).toUpperCase() as ProductStatus;
    const allowed: ProductStatus[] = [
      "DRAFT",
      "PUBLISHED",
      "ARCHIVED",
    ];
    if (allowed.includes(s)) status = s;
    else errors.push("Status produk tidak valid");
  }
  const legacyPlanId =
    input.legacyPlanId == null || String(input.legacyPlanId).trim() === ""
      ? null
      : String(input.legacyPlanId).trim();
  const courseId =
    input.courseId == null || String(input.courseId).trim() === ""
      ? null
      : String(input.courseId).trim();
  return {
    errors,
    data: {
      name,
      description,
      type,
      price,
      features,
      faq,
      thumbnail,
      affiliatePercent,
      status,
      legacyPlanId,
      courseId,
    },
  };
}

export function slugifyProduct(name: string, seed?: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\u00e0-\u1eff\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60) || "product";
  const rand = seed || Math.random().toString(36).slice(2, 6);
  return `${base}-${rand}`;
}

export type CouponInput = {
  code?: string;
  type?: string;
  value?: number;
  active?: boolean;
  maxUses?: number | null;
  startAt?: string | null;
  endAt?: string | null;
  productIds?: string[] | null;
};

export function normalizeCouponInput(input: CouponInput): {
  errors: string[];
  data: {
    code: string;
    type: "PERCENT" | "FIXED";
    value: number;
    active: boolean;
    maxUses: number | null;
    startAt: Date | null;
    endAt: Date | null;
    productIds: string[];
  };
} {
  const errors: string[] = [];
  const code = (input.code || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!code) errors.push("Kode kupon wajib diisi");
  if (code.length > 24) errors.push("Kode kupon maksimal 24 karakter");
  let type: "PERCENT" | "FIXED" = "PERCENT";
  if (!input.type) errors.push("Jenis kupon (PERCENT/FIXED) wajib dipilih");
  else {
    const t = String(input.type).toUpperCase();
    if (t === "PERCENT" || t === "FIXED") type = t;
    else errors.push("Jenis kupon tidak valid");
  }
  const raw = Number(input.value ?? NaN);
  if (!Number.isFinite(raw) || raw < 1) errors.push("Nilai kupon minimal 1");
  const value = Math.floor(Number.isFinite(raw) ? raw : 0);
  if (type === "PERCENT" && value > 100) errors.push("Persentase maksimal 100");
  const active = input.active !== false;
  let maxUses: number | null = null;
  if (input.maxUses != null) {
    const n = Number(input.maxUses);
    if (Number.isFinite(n) && n >= 1) maxUses = Math.floor(n);
    else errors.push("Batas penggunaan bila diisi harus bilangan bulat >= 1");
  }
  let startAt: Date | null = null;
  if (input.startAt) {
    const d = new Date(input.startAt);
    if (isNaN(d.getTime())) errors.push("Tanggal mulai tidak valid");
    else startAt = d;
  }
  let endAt: Date | null = null;
  if (input.endAt) {
    const d = new Date(input.endAt);
    if (isNaN(d.getTime())) errors.push("Tanggal berakhir tidak valid");
    else endAt = d;
  }
  if (startAt && endAt && endAt <= startAt) {
    errors.push("Tanggal berakhir harus setelah tanggal mulai");
  }
  const productIds = Array.isArray(input.productIds) ? input.productIds.filter(Boolean) : [];
  return { errors, data: { code, type, value, active, maxUses, startAt, endAt, productIds } };
}
