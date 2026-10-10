import { requireAdmin } from "@/lib/auth"; import { db } from "@/lib/db"; import { CouponEditor } from "@/components/CouponEditor";
export default async function NewCouponPage() {
  await requireAdmin();
  const products = await db.product.findMany({ select: { id: true, name: true, type: true, status: true }, orderBy: { name: "asc" } });
  return (<>
    <div className="page-head"><div><h1>Tambah Kupon Baru</h1><p>Buat kode diskon baru yang dapat dipakai saat checkout produk.</p></div></div>
    <div className="panel"><CouponEditor initial={null} products={products}/></div>
  </>);
}
