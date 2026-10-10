import { requireAdmin } from "@/lib/auth"; import { db } from "@/lib/db"; import { ProductEditor } from "@/components/ProductEditor";
export default async function NewProductPage() {
  await requireAdmin();
  const [courses, plans] = await Promise.all([
    db.course.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true, isPublished: true } }),
    db.plan.findMany({ orderBy: { price: "asc" }, select: { id: true, name: true, durationDays: true } }),
  ]);
  return (<>
    <div className="page-head"><div><h1>Tambah Produk Baru</h1><p>Buat produk digital pertama Anda. Isi data dasar, asset, lalu terbitkan setelah lengkap.</p></div></div>
    <div className="panel"><ProductEditor initial={null} courses={courses} plans={plans} assets={[]} bundleOf={[]} bumps={[]}/></div>
  </>);
}
