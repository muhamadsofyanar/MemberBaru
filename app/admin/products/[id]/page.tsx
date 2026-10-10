import { notFound } from "next/navigation"; import { requireAdmin } from "@/lib/auth"; import { db } from "@/lib/db"; import { ProductEditor } from "@/components/ProductEditor";
export default async function AdminProductEdit({params}:{params:Promise<{id:string}>}) {
  await requireAdmin();
  const {id}=await params;
  const [product, courses, plans] = await Promise.all([
    db.product.findUnique({ where: { id }, include: { assets: { orderBy: { createdAt: "desc" } }, bundleOf: true, bumps: true } }),
    db.course.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true, isPublished: true } }),
    db.plan.findMany({ orderBy: { price: "asc" }, select: { id: true, name: true, durationDays: true } }),
  ]);
  if (!product) return notFound();
  return (<>
    <div className="page-head"><div><h1>Edit Produk</h1><p>Perbarui detail produk, asset, setelan akses, dan status penerbitan.</p></div></div>
    <div className="panel"><ProductEditor initial={product} courses={courses} plans={plans} assets={product.assets} bundleOf={product.bundleOf} bumps={product.bumps}/></div>
  </>);
}
