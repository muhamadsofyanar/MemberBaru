-- ============================================================================
--  RizqHub Membership v1.1.0 -> v1.2.0 SQL Upgrade
--  Tujuan: Aditif. Semua operasi CREATE / ADD COLUMN saja.
--  PENTING: Backup DB (pg_dump) + backup storage/private SEBELUM menjalankan.
--           Jangan pakai prisma db push di production. Jalankan:
--               psql -U <user> -d <db> -f prisma/upgrade/1.2.0.sql
--  Rollback: jika hanya sampai migrasi schema tanpa transaksi order 1.2.0,
--            cukup restore backup; jika sudah ada transaksi 1.2.0, restore
--            coordinated, tidak cukup hanya DROP TABLE baru.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Versi penanda (opsional)
-- ---------------------------------------------------------------------------
INSERT INTO "Setting" ("key", "value") VALUES ('schema_version', '1.2.0')
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value";

-- Default tenggat order (jam)
INSERT INTO "Setting" ("key", "value") VALUES ('order_expiry_hours', '24')
ON CONFLICT ("key") DO NOTHING;

-- ---------------------------------------------------------------------------
-- 1. Enums (PostgreSQL CREATE TYPE IF NOT EXISTS)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "ProductType" AS ENUM ('EBOOK', 'TEMPLATE', 'COURSE', 'MEMBERSHIP', 'BUNDLE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "OrderItemSource" AS ENUM ('MAIN', 'BUMP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "GrantKind" AS ENUM ('ASSET', 'COURSE', 'PLAN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 2. Alter Table Order (kolom aditif & longgarkan relasi planId)
-- ---------------------------------------------------------------------------
ALTER TABLE "Order" ALTER COLUMN "planId" DROP NOT NULL;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "subtotal" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "discountTotal" INTEGER;
ALTER TABLE "Order" ALTER COLUMN "amount" DROP NOT NULL;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "proofSubmittedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "legacy" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS "Order_expiresAt_status_idx" ON "Order"("expiresAt", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "Order_idempotencyKey_key" ON "Order"("idempotencyKey");

-- ---------------------------------------------------------------------------
-- 3. Tabel produk
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Product" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "type" "ProductType" NOT NULL,
  "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "price" INTEGER NOT NULL,
  "affiliatePercent" INTEGER NOT NULL DEFAULT 20,
  "thumbnail" TEXT,
  "features" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "faq" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "legacyPlanId" TEXT,
  "courseId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Product_slug_key" ON "Product"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "Product_legacyPlanId_key" ON "Product"("legacyPlanId");
CREATE INDEX IF NOT EXISTS "Product_status_type_idx" ON "Product"("status", "type");

DO $$ BEGIN
  ALTER TABLE "Product" ADD CONSTRAINT "Product_legacyPlanId_fkey"
    FOREIGN KEY ("legacyPlanId") REFERENCES "Plan"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Product" ADD CONSTRAINT "Product_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 4. Tabel asset
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ProductAsset" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductAsset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProductAsset_productId_idx" ON "ProductAsset"("productId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductAsset_storageKey_key" ON "ProductAsset"("storageKey");
DO $$ BEGIN
  ALTER TABLE "ProductAsset" ADD CONSTRAINT "ProductAsset_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 5. Bundle, Bump, Coupon, CouponProduct
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "BundleItem" (
  "id" TEXT NOT NULL,
  "bundleId" TEXT NOT NULL,
  "componentId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BundleItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BundleItem_bundleId_componentId_key" ON "BundleItem"("bundleId", "componentId");
CREATE INDEX IF NOT EXISTS "BundleItem_bundleId_idx" ON "BundleItem"("bundleId");
DO $$ BEGIN
  ALTER TABLE "BundleItem" ADD CONSTRAINT "BundleItem_bundleId_fkey"
    FOREIGN KEY ("bundleId") REFERENCES "Product"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "BundleItem" ADD CONSTRAINT "BundleItem_componentId_fkey"
    FOREIGN KEY ("componentId") REFERENCES "Product"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ProductBump" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "bumpOfferId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductBump_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProductBump_productId_key" ON "ProductBump"("productId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductBump_bumpOfferId_key" ON "ProductBump"("bumpOfferId");
DO $$ BEGIN
  ALTER TABLE "ProductBump" ADD CONSTRAINT "ProductBump_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProductBump" ADD CONSTRAINT "ProductBump_bumpOfferId_fkey"
    FOREIGN KEY ("bumpOfferId") REFERENCES "Product"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Coupon" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "type" "DiscountType" NOT NULL,
  "value" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "maxUses" INTEGER,
  "startAt" TIMESTAMP(3),
  "endAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Coupon_code_key" ON "Coupon"("code");
CREATE INDEX IF NOT EXISTS "Coupon_active_idx" ON "Coupon"("active");

CREATE TABLE IF NOT EXISTS "CouponProduct" (
  "couponId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  CONSTRAINT "CouponProduct_pkey" PRIMARY KEY ("couponId", "productId")
);
DO $$ BEGIN
  ALTER TABLE "CouponProduct" ADD CONSTRAINT "CouponProduct_couponId_fkey"
    FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CouponProduct" ADD CONSTRAINT "CouponProduct_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 6. OrderItem, OrderGrant, Entitlement, CouponReservation
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "OrderItem" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "source" "OrderItemSource" NOT NULL DEFAULT 'MAIN',
  "productSnapshotName" TEXT NOT NULL,
  "productSnapshotType" "ProductType" NOT NULL,
  "productId" TEXT,
  "price" INTEGER NOT NULL,
  "discount" INTEGER NOT NULL DEFAULT 0,
  "netPrice" INTEGER NOT NULL,
  "affiliatePercent" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");
DO $$ BEGIN
  ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "OrderGrant" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "kind" "GrantKind" NOT NULL,
  "grantRefId" TEXT NOT NULL,
  "snapshotName" TEXT NOT NULL,
  "durationDays" INTEGER,
  "productId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderGrant_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OrderGrant_orderId_idx" ON "OrderGrant"("orderId");
CREATE INDEX IF NOT EXISTS "OrderGrant_kind_grantRefId_idx" ON "OrderGrant"("kind", "grantRefId");
DO $$ BEGIN
  ALTER TABLE "OrderGrant" ADD CONSTRAINT "OrderGrant_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "OrderGrant" ADD CONSTRAINT "OrderGrant_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Entitlement" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orderGrantId" TEXT NOT NULL,
  "kind" "GrantKind" NOT NULL,
  "grantRefId" TEXT NOT NULL,
  "productId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Entitlement_orderGrantId_key" ON "Entitlement"("orderGrantId");
CREATE UNIQUE INDEX IF NOT EXISTS "Entitlement_userId_kind_grantRefId_key"
  ON "Entitlement"("userId", "kind", "grantRefId");
CREATE INDEX IF NOT EXISTS "Entitlement_userId_idx" ON "Entitlement"("userId");
DO $$ BEGIN
  ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_orderGrantId_fkey"
    FOREIGN KEY ("orderGrantId") REFERENCES "OrderGrant"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CouponReservation" (
  "id" TEXT NOT NULL,
  "couponId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponReservation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CouponReservation_orderId_key" ON "CouponReservation"("orderId");
CREATE INDEX IF NOT EXISTS "CouponReservation_couponId_idx" ON "CouponReservation"("couponId");
DO $$ BEGIN
  ALTER TABLE "CouponReservation" ADD CONSTRAINT "CouponReservation_couponId_fkey"
    FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CouponReservation" ADD CONSTRAINT "CouponReservation_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- DATA MIGRATION LEGACY (1.1.0 -> 1.2.0)
-- ============================================================================

-- Produk MEMBERSHIP untuk setiap Plan yang ada (dengan slug deterministik)
INSERT INTO "Product" (
  "id", "slug", "type", "status", "name", "description", "price",
  "affiliatePercent", "thumbnail", "features", "faq",
  "legacyPlanId", "courseId", "createdAt", "updatedAt"
)
SELECT
  'legacyplan_' || "id" AS "id",
  COALESCE(
    (SELECT p2."slug" FROM "Product" p2 WHERE p2."slug" = "slug"),
    'plan-' || "slug"
  ) AS "slug",
  'MEMBERSHIP'::"ProductType" AS "type",
  CASE WHEN "isActive" THEN 'PUBLISHED'::"ProductStatus"
       ELSE 'ARCHIVED'::"ProductStatus" END AS "status",
  "name",
  "description",
  "price",
  "affiliatePercent",
  NULL AS "thumbnail",
  COALESCE("features", '[]'::jsonb) AS "features",
  '[]'::jsonb AS "faq",
  "id" AS "legacyPlanId",
  NULL AS "courseId",
  "createdAt",
  "updatedAt"
FROM "Plan"
WHERE NOT EXISTS (SELECT 1 FROM "Product" p WHERE p."legacyPlanId" = "Plan"."id");

-- Order legacy: tandai flag agar jalur approval 1.1.0 terpakai,
-- dan buat OrderItem MAIN + OrderGrant PLAN sesuai planId (hanya jika order
-- 1.2.0 items belum ada, alias items.length=0 yang di-deteksi dari planId).
UPDATE "Order" SET "legacy" = TRUE WHERE "planId" IS NOT NULL;

-- Order yang planId IS NOT NULL: buat 1 OrderItem MAIN snapshot Plan-nya.
INSERT INTO "OrderItem" (
  "id", "orderId", "source", "productSnapshotName", "productSnapshotType",
  "productId", "price", "discount", "netPrice", "affiliatePercent", "createdAt"
)
SELECT
  'legacyitem_' || "Order"."id" AS "id",
  "Order"."id" AS "orderId",
  'MAIN'::"OrderItemSource" AS "source",
  "Plan"."name" AS "productSnapshotName",
  'MEMBERSHIP'::"ProductType" AS "productSnapshotType",
  "Product"."id" AS "productId",
  "Order"."amount" AS "price",
  0 AS "discount",
  "Order"."amount" AS "netPrice",
  COALESCE("Order"."affiliatePercentSnapshot", "Plan"."affiliatePercent", 0) AS "affiliatePercent",
  "Order"."createdAt"
FROM "Order"
JOIN "Plan" ON "Plan"."id" = "Order"."planId"
LEFT JOIN "Product" ON "Product"."legacyPlanId" = "Plan"."id"
WHERE "Order"."planId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "OrderItem" WHERE "OrderItem"."orderId" = "Order"."id"
  );

-- Order PAID legacy: buat OrderGrant PLAN (snapshot planId).
INSERT INTO "OrderGrant" (
  "id", "orderId", "orderItemId", "kind", "grantRefId", "snapshotName",
  "durationDays", "productId", "createdAt"
)
SELECT
  'legacygrant_' || "OrderItem"."id" AS "id",
  "OrderItem"."orderId",
  "OrderItem"."id" AS "orderItemId",
  'PLAN'::"GrantKind" AS "kind",
  "Plan"."id" AS "grantRefId",
  "Plan"."name" AS "snapshotName",
  "Order"."durationDaysSnapshot" AS "durationDays",
  "OrderItem"."productId",
  "Order"."createdAt"
FROM "OrderItem"
JOIN "Order" ON "Order"."id" = "OrderItem"."orderId"
JOIN "Plan" ON "Plan"."id" = "Order"."planId"
WHERE "OrderItem"."id" LIKE 'legacyitem_%'
  AND "Order"."planId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "OrderGrant" g WHERE g."orderId" = "Order"."id"
  );

-- Order PAID legacy: buat Entitlement PLAN (agar Produk Saya bisa menampilkan
-- akses membership dari order 1.1.0 yang sudah paid). Membership existing
-- TIDAK dibuat ulang. Entitlement hanya record allow-list.
INSERT INTO "Entitlement" (
  "id", "userId", "orderGrantId", "kind", "grantRefId", "productId", "createdAt"
)
SELECT
  'legacyent_' || "OrderGrant"."id" AS "id",
  "Order"."userId",
  "OrderGrant"."id" AS "orderGrantId",
  "OrderGrant"."kind",
  "OrderGrant"."grantRefId",
  "OrderGrant"."productId",
  "Order"."paidAt"
FROM "OrderGrant"
JOIN "Order" ON "Order"."id" = "OrderGrant"."orderId"
WHERE "OrderGrant"."id" LIKE 'legacygrant_%'
  AND "Order"."status" = 'PAID'
  AND NOT EXISTS (
    SELECT 1 FROM "Entitlement" e WHERE e."orderGrantId" = "OrderGrant"."id"
  );

-- Order PENDING legacy yang punya paymentProof → isi proofSubmittedAt.
-- Diberikan updatedAt sebagai tanda; expiresAt TIDAK diisi (tidak ada
-- retroactive tenggat) sesuai spesifikasi.
UPDATE "Order"
SET "proofSubmittedAt" = "updatedAt"
WHERE "planId" IS NOT NULL
  AND "status" = 'PENDING'
  AND "paymentProof" IS NOT NULL
  AND "proofSubmittedAt" IS NULL;

-- Tandai order legacy planId untuk order 1.1.0 agar jalur approval 1.1.0
-- dipakai (pembuatan Membership tetap 1 row per order).
UPDATE "Order" SET "legacy" = TRUE WHERE "planId" IS NOT NULL;

COMMIT;
