import Link from "next/link"; import { requireUser } from "@/lib/auth"; import { db } from "@/lib/db"; import { dateID, rupiah } from "@/lib/utils";
export default async function Invoices() {
  const user = await requireUser();
  const orders = await db.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { plan: true, items: true },
  });
  return (<>
  <div className="page-head"><div>
  <h1>Invoice Saya</h1>
  <p>Daftar order membership, produk, bundel, atau kursus Anda. Klik untuk detail, upload bukti, atau cek status.</p>
  </div></div>
  <div className="panel table-wrap"><table className="table"><thead><tr>
  <th>Invoice</th><th>Produk / Paket</th><th>Tanggal</th><th>Nominal</th><th>Tenggat</th><th>Status</th><th>Aksi</th>
  </tr></thead><tbody>
  {orders.map(o => {
    const label = o.plan?.name ?? (o.items?.length ? o.items.map(i => i.productSnapshotName).join(", ") : "Produk Digital");
    const statusTxt = o.status === "PENDING" ? (o.proofSubmittedAt ? "Menunggu verifikasi" : "Bukti belum dikirim") : o.status;
    return (<tr key={o.id}>
      <td><b>{o.invoice}</b></td>
      <td>{label}</td>
      <td>{dateID(o.createdAt)}</td>
      <td>{rupiah(o.amount ?? 0)}</td>
      <td>{o.expiresAt ? dateID(o.expiresAt) : "-"}</td>
      <td><span className={`status status-${o.status.toLowerCase()}`}>{statusTxt}</span></td>
      <td><Link className="btn btn-ghost btn-sm" href={`/dashboard/invoices/${o.id}`}>Detail</Link></td>
    </tr>);
  })}
  {!orders.length && <tr><td colSpan={7} className="empty">Belum ada invoice. Lihat <Link href="/products">katalog</Link> untuk memulai.</td></tr>}
  </tbody></table></div>
  </>);
}
