import Link from "next/link"; import { requireAdmin } from "@/lib/auth"; import { db } from "@/lib/db"; import { dateID, rupiah } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = { EBOOK: "E-Book", TEMPLATE: "Template", COURSE: "Kursus", MEMBERSHIP: "Membership", BUNDLE: "Bundel" };

export default async function AdminProducts() {
  await requireAdmin();
  const products = await db.product.findMany({ orderBy: { updatedAt: "desc" }, include: { _count: { select: { assets: true, bundleOf: true, orderItems: true } } } });
  return (<>
  <div className="page-head"><div><h1>Kelola Produk</h1><p>Tambah, edit, terbitkan, atau arsipkan produk digital yang dijual di katalog.</p></div></div>
  <div className="panel table-wrap"><div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}><Link className="btn btn-primary btn-sm" href="/admin/products/new">+ Tambah Produk</Link></div>
  <table className="table"><thead><tr><th>Produk</th><th>Jenis</th><th>Harga</th><th>Assets</th><th>Terjual</th><th>Status</th><th>Diperbarui</th><th>Aksi</th></tr></thead><tbody>
  {products.map(p => (<tr key={p.id}>
    <td><b>{p.name}</b><div><small className="muted">slug: /{p.slug}</small></div></td>
    <td>{TYPE_LABEL[p.type] || p.type}</td>
    <td>{rupiah(p.price)}</td>
    <td>{p._count.assets}</td>
    <td>{p._count.orderItems}</td>
    <td><span className={`status status-${p.status.toLowerCase()}`}>{p.status}</span></td>
    <td>{dateID(p.updatedAt)}</td>
    <td><Link className="btn btn-ghost btn-sm" href={`/admin/products/${p.id}`}>Edit</Link></td>
  </tr>))}
  {!products.length && <tr><td colSpan={8} className="empty">Belum ada produk. Tambahkan produk pertama.</td></tr>}
  </tbody></table></div>
  </>);
}
