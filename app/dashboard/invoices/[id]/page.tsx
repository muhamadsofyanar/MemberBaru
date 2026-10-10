import { notFound } from "next/navigation"; import { requireUser } from "@/lib/auth"; import { db } from "@/lib/db"; import { dateID, rupiah } from "@/lib/utils"; import { UploadProofClient } from "@/components/UploadProofClient";

export default async function InvoiceDetail({params}:{params:Promise<{id:string}>}) {
  const user = await requireUser();
  const {id} = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: { plan: true, items: true, grants: true, couponReservation: { include: { coupon: true } } },
  });
  if (!order) return notFound();
  if (order.userId !== user.id) return notFound();
  const isLegacy = order.legacy === true || (!!order.planId && (!order.items || order.items.length === 0));
  const settings = Object.fromEntries((await db.setting.findMany()).map(s=>[s.key,s.value]));
  const total = order.amount ?? 0;
  const subtotal = order.subtotal ?? total;
  const disc = order.discountTotal ?? 0;
  return (<>
  <div className="page-head"><div>
  <h1>Invoice #{order.invoice}</h1>
  <p>Order #{order.id.slice(0,8)} • Dibuat {dateID(order.createdAt)}</p>
  </div>
  <div className="page-head-actions"><span className={`status status-${order.status.toLowerCase()}`}>{order.status}</span></div>
  </div>
  <div className="panel"><div className="cards" style={{gridTemplateColumns:"minmax(0,1.2fr) minmax(0,1fr)"}}>
    <div>
      <h2>Ringkasan Tagihan</h2>
      <table className="table"><thead><tr><th>Item</th><th style={{textAlign:"right"}}>Subtotal</th><th style={{textAlign:"right"}}>Diskon</th><th style={{textAlign:"right"}}>Nett</th></tr></thead><tbody>
      {isLegacy && order.plan && (<tr><td>Paket {order.plan.name} <small className="muted">(MEMBERSHIP)</small></td>
        <td style={{textAlign:"right"}}>{rupiah(order.plan.price)}</td>
        <td style={{textAlign:"right"}}>{rupiah(disc)}</td>
        <td style={{textAlign:"right"}}>{rupiah(total)}</td>
      </tr>)}
      {order.items && order.items.map(it => (<tr key={it.id}>
        <td>{it.source==="MAIN"?"🏷️ ":"🎁 "}{it.productSnapshotName} <small className="muted">({it.productSnapshotType})</small></td>
        <td style={{textAlign:"right"}}>{rupiah(it.price)}</td>
        <td style={{textAlign:"right"}}>{rupiah(it.discount)}</td>
        <td style={{textAlign:"right"}}>{rupiah(it.netPrice)}</td>
      </tr>))}
      </tbody></table>
      <div className="card" style={{marginTop:12}}><div className="stack" style={{gap:6}}>
        <div style={{display:"flex",justifyContent:"space-between"}}><span className="muted">Subtotal</span><b>{rupiah(subtotal)}</b></div>
        {disc > 0 && <div style={{display:"flex",justifyContent:"space-between"}}><span className="muted">Diskon {order.couponReservation?.coupon?.code ? `(kupon ${order.couponReservation.coupon.code})`: ""}</span><b style={{color:"#1a7f37"}}>−{rupiah(disc)}</b></div>}
        <hr/><div style={{display:"flex",justifyContent:"space-between",fontSize:18}}><span>Total</span><b style={{fontSize:22}}>{rupiah(total)}</b></div>
      </div></div>
    </div>
    <div>
      <h2>Kirim Bukti Transfer</h2>
      <div className="card" style={{background:"#f5faf7"}}><div className="stack"><span className="muted">Transfer ke rekening:</span>
      <b>{settings.bank_name||"Rekening belum diatur"}</b>
      <span className="code-box">{settings.bank_account||"-"}</span>
      <b>a.n. {settings.bank_holder||"-"}</b></div></div>
      <p style={{margin:"8px 0 12px"}} className="muted">
        Tenggat: <b>{order.expiresAt ? dateID(order.expiresAt) : "24 jam"}</b>
        {order.proofSubmittedAt && <> • Terakhir dikirim: {dateID(order.proofSubmittedAt)}</>}
      </p>
      <UploadProofClient orderId={order.id} status={order.status}
        proofSubmittedAt={order.proofSubmittedAt ? order.proofSubmittedAt.toISOString() : null}
        expiresAt={order.expiresAt ? order.expiresAt.toISOString() : null}
        invoiceExisting={order.paymentProof}
        transferAccountExisting={order.transferAccount}
        notesExisting={order.notes}/>
    </div>
  </div></div>
  {order.status === "PAID" && order.grants && order.grants.length > 0 && (
    <div className="panel"><h2>Akses yang Anda Dapatkan</h2><div className="cards" style={{gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))"}}>
      {order.grants.map(g => (<div key={g.id} className="card">
        <div className="card-label">Jenis Akses</div>
        <div className="card-value">{g.snapshotName}</div>
        <p className="muted">{g.kind} • {g.durationDays ? `Aktif ${g.durationDays} hari` : "Akses sesuai produk"}</p>
        {g.kind === "ASSET" && <a className="btn btn-primary btn-sm" href={`/api/products/assets/${g.grantRefId}`}>Unduh File</a>}
        {g.kind === "COURSE" && <a className="btn btn-primary btn-sm" href="/dashboard/courses">Buka Kelas Saya</a>}
      </div>))}
    </div></div>
  )}
  </>);
}
