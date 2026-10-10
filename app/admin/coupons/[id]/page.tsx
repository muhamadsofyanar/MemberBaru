import { notFound } from "next/navigation"; import { requireAdmin } from "@/lib/auth"; import { db } from "@/lib/db"; import { CouponEditor } from "@/components/CouponEditor";
export default async function AdminCouponEdit({params}:{params:Promise<{id:string}>}) {
  await requireAdmin();
  const {id}=await params;
  const coupon = await db.coupon.findUnique({ where: { id }, include: { products: true } });
  if (!coupon) return notFound();
  const products = await db.product.findMany({ select: { id: true, name: true, type: true, status: true }, orderBy: { name: "asc" } });
  return (<>
    <div className="page-head"><div><h1>Edit Kupon {coupon.code}</h1><p>Perbarui kode, nilai, kuota, dan batasan produk kupon.</p></div></div>
    <div className="panel"><CouponEditor initial={coupon} products={products}/></div>
  </>);
}
