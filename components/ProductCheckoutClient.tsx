"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { rupiah } from "@/lib/utils";
import type { BuildOrderPreview } from "@/lib/pricing";
import { randomUUID } from "crypto";
function cryptoUUID(): string {
  if (typeof window !== "undefined" && window.crypto && "randomUUID" in window.crypto) return (window.crypto as any).randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0, v = c === "x" ? r : (r & 0x3) | 0x8; return v.toString(16); });
}

export function ProductCheckoutClient({
  productMainId, bumpOptions, defaultTotal,
}: { productMainId: string; bumpOptions: { id: string; name: string; price: number; status: string; type: string }[]; defaultTotal: number; }) {
  const router = useRouter();
  const [bumpOfferId, setBumpOfferId] = useState<string>("");
  const [couponCode, setCouponCode] = useState<string>("");
  const [couponApplied, setCouponApplied] = useState<{code:string;type:string;value:number}|null>(null);
  const [couponError, setCouponError] = useState<string>("");
  const [preview, setPreview] = useState<BuildOrderPreview|null>(null);
  const [previewing, setPreviewing] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  async function refreshPreview() {
    setPreviewing(true);
    setError("");
    setCouponError("");
    try {
      const body: any = { productMainId, bumpOfferId: bumpOfferId || null };
      if (couponCode.trim()) body.couponCode = couponCode.trim();
      const r = await fetch("/api/checkout/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) { setError(j.error || j.errors?.[0] || "Gagal hitung."); setPreview(null); return; }
      setPreview(j as BuildOrderPreview);
      if (j.couponApplied) setCouponApplied({ code: j.couponApplied.code, type: j.couponApplied.type, value: j.couponApplied.value });
      else setCouponApplied(null);
      if (j.couponError) setCouponError(j.couponError);
    } finally { setPreviewing(false); }
  }

  async function submit() {
    setLoading(true); setError("");
    try {
      const body: any = { productMainId, bumpOfferId: bumpOfferId || null, idempotencyKey: cryptoUUID() };
      if (couponCode.trim()) body.couponCode = couponCode.trim();
      const r = await fetch("/api/orders/product", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) { setError(j.error || "Gagal membuat order."); return; }
      const id = j.order?.id;
      if (id) router.push(`/dashboard/invoices/${id}`);
      else router.push("/dashboard/orders");
    } finally { setLoading(false); }
  }

  const items = preview?.items || [];
  const subtotal = preview?.subtotal ?? defaultTotal;
  const discount = preview?.discountTotal ?? 0;
  const total = preview?.amount ?? defaultTotal;
  const expires = preview?.expiresAt ? new Date(preview.expiresAt) : null;

  return (<div className="panel" style={{display:"flex",flexDirection:"column",gap:16}}>
  {error && <div className="alert alert-error">{error}</div>}
  {bumpOptions && bumpOptions.length > 0 && (
    <div className="field">
      <label>Tambahkan penawaran spesial (order bump)</label>
      <select value={bumpOfferId} onChange={e=>{setBumpOfferId(e.target.value);}}>
        <option value="">Tidak, terima kasih</option>
        {bumpOptions.filter(b=>b.status==="PUBLISHED").map(b=>(
          <option key={b.id} value={b.id}>{b.name} — +{rupiah(b.price)}</option>
        ))}
      </select>
    </div>
  )}
  <div className="field" style={{margin:0}}>
    <label>Kupon (opsional)</label>
    <div style={{display:"flex",gap:8}}>
      <input value={couponCode} onChange={e=>setCouponCode(e.target.value.toUpperCase())} placeholder="KODEKUPON" style={{flex:1}}/>
      <button type="button" className="btn btn-ghost btn-sm" onClick={refreshPreview} disabled={previewing}>{previewing?"Cek...":"Cek Kupon"}</button>
    </div>
    {couponApplied && <div className="alert alert-success">Kupon {couponApplied.code} diterapkan.</div>}
    {couponError && <div className="alert alert-error">{couponError}</div>}
  </div>
  <table className="table">
    <thead><tr><th>Item</th><th style={{textAlign:"right"}}>Harga</th></tr></thead>
    <tbody>
      {items.length === 0 && <tr><td>(belum diperbarui)</td><td style={{textAlign:"right"}}>{rupiah(defaultTotal)}</td></tr>}
      {items.map((it, i) => (
        <tr key={i}><td>{it.source==="MAIN"?"🏷️ ":"🎁 "}{it.name} <small className="muted">({it.type})</small></td><td style={{textAlign:"right"}}>{rupiah(it.netPrice)}</td></tr>
      ))}
    </tbody>
  </table>
  <div className="card"><div className="stack" style={{gap:6}}><div style={{display:"flex",justifyContent:"space-between"}}><span className="muted">Subtotal</span><b>{rupiah(subtotal)}</b></div>{discount>0 && <div style={{display:"flex",justifyContent:"space-between"}}><span className="muted">Diskon</span><b style={{color:"#1a7f37"}}>−{rupiah(discount)}</b></div>}<hr style={{margin:"4px 0"}}/><div style={{display:"flex",justifyContent:"space-between",fontSize:18}}><span>Total</span><b style={{fontSize:22}}>{rupiah(total)}</b></div>{expires && <p className="muted" style={{fontSize:12,margin:0}}>Selesaikan pembayaran &amp; kirim bukti sebelum: <b>{expires.toLocaleString("id-ID")}</b></p>}</div></div>
  <button className="btn btn-primary btn-block" onClick={submit} disabled={loading||previewing}>{loading?"Membuat Order...":"Buat Order &amp; Lanjutkan"}</button>
  <p className="muted" style={{fontSize:12,margin:0,textAlign:"center"}}>Setelah order dibuat, Anda akan mengunggah bukti transfer pada halaman invoice.</p>
  </div>);
}
