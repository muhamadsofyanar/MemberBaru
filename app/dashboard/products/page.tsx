import Link from "next/link"; import { requireUser } from "@/lib/auth"; import { db } from "@/lib/db";
const KIND_LABEL: Record<string, string> = { ASSET: "Berkas Unduhan", COURSE: "Kursus", PLAN: "Paket Membership", PRODUCT: "Produk" };
export default async function MyProducts() {
  const user = await requireUser();
  const entitlements = await db.entitlement.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { orderGrant: { include: { order: true } }, product: true },
  });
  const activeMemberships = await db.membership.findMany({
    where: { userId: user.id, status: "ACTIVE", endsAt: { gt: new Date() } },
    orderBy: { endsAt: "desc" },
    include: { plan: true, order: true },
  });
  return (<>
  <div className="page-head"><div>
  <h1>Produk Saya</h1>
  <p>Semua produk, berkas, kursus, dan paket membership yang telah Anda dapatkan.</p>
  </div></div>
  {activeMemberships.length > 0 && (<div className="panel">
    <h2>Paket Membership Aktif</h2>
    <div className="cards" style={{gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))"}}>
      {activeMemberships.map(m => (<div key={m.id} className="card">
        <div className="card-label">Paket Aktif</div>
        <div className="card-value">{m.plan?.name || "Paket"}</div>
        <p className="muted">Sampai {new Date(m.endsAt).toLocaleDateString("id-ID")} • {Math.ceil((m.endsAt.getTime() - Date.now()) / 86400000)} hari lagi</p>
        <Link className="btn btn-ghost btn-sm" href="/dashboard/courses">Buka Kelas</Link>
      </div>))}
    </div>
  </div>)}
  <div className="panel"><h2>Semua Entitlement</h2>
  <div className="cards" style={{gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))"}}>
    {entitlements.length === 0 && <div className="card"><p className="muted">Belum ada entitlement. Belanja produk di <Link href="/products">katalog</Link>.</p></div>}
    {entitlements.map(e => (<div key={e.id} className="card">
      <div className="card-label">{KIND_LABEL[e.kind] || e.kind}</div>
      <div className="card-value">{e.orderGrant?.snapshotName || e.product?.name || "Item"}</div>
      <p className="muted">Diperoleh {new Date(e.createdAt).toLocaleDateString("id-ID")}</p>
      {e.kind === "ASSET" && <a className="btn btn-primary btn-sm" href={`/api/products/assets/${e.grantRefId}`}>Unduh Berkas</a>}
      {e.kind === "COURSE" && <Link className="btn btn-primary btn-sm" href="/dashboard/courses">Buka Kelas Saya</Link>}
      {e.kind === "PLAN" && <Link className="btn btn-primary btn-sm" href="/dashboard">Lihat Dashboard</Link>}
    </div>))}
  </div></div>
  </>);
}
