import Link from "next/link"; import { requireAdmin } from "@/lib/auth"; import { db } from "@/lib/db"; import { dateID } from "@/lib/utils";

export default async function AdminCoupons() {
  await requireAdmin();
  const coupons = await db.coupon.findMany({ orderBy: { createdAt: "desc" }, include: { products: { include: { product: true } }, reservations: true } });
  return (<>
    <div className="page-head"><div><h1>Kelola Kupon</h1><p>Kode diskon untuk checkout produk digital. Dapat dibatasi per produk, jumlah penggunaan, dan periode.</p></div><div className="page-head-actions"><Link className="btn btn-primary btn-sm" href="/admin/coupons/new">+ Tambah Kupon</Link></div></div>
    <div className="panel table-wrap"><table className="table"><thead><tr>
      <th>Kode</th><th>Jenis</th><th>Nilai</th><th>Pakai</th><th>Aktif</th><th>Periode</th><th>Produk</th><th>Aksi</th>
    </tr></thead><tbody>
      {coupons.map(c => {
        const used = c.reservations.filter(r => r.usedAt).length;
        const pending = c.reservations.length - used;
        const max = c.maxUses;
        return (<tr key={c.id}>
          <td><b>{c.code}</b></td>
          <td>{c.type}</td>
          <td>{c.type === "PERCENT" ? `${c.value}%` : `Rp${c.value.toLocaleString("id-ID")}`}</td>
          <td>{used} dipakai / {max ?? "∞"} {pending > 0 && <span className="muted">(+{pending} cadangan)</span>}</td>
          <td>{c.active ? "✓" : "—"}</td>
          <td><small>{c.startAt ? dateID(c.startAt) : "segera"} s/d<br/>{c.endAt ? dateID(c.endAt) : "selamanya"}</small></td>
          <td>{c.products.length === 0 ? <small className="muted">semua</small> : c.products.map(p => p.product?.name).slice(0, 2).join(", ") + (c.products.length > 2 ? ` +${c.products.length - 2}` : "")}</td>
          <td><Link className="btn btn-ghost btn-sm" href={`/admin/coupons/${c.id}`}>Edit</Link></td>
        </tr>);
      })}
      {!coupons.length && <tr><td colSpan={8} className="empty">Belum ada kupon.</td></tr>}
    </tbody></table></div>
  </>);
}
