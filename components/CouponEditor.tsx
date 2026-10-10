"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function CouponEditor({initial, products}: any) {
  const router = useRouter();
  const id = initial?.id;
  const [code, setCode] = useState<string>(initial?.code || "");
  const [type, setType] = useState<any>(initial?.type || "PERCENT");
  const [value, setValue] = useState<number>(initial?.value ?? 10);
  const [active, setActive] = useState<boolean>(initial?.active ?? true);
  const [maxUses, setMaxUses] = useState<string>(initial?.maxUses != null ? String(initial.maxUses) : "");
  const [startAt, setStartAt] = useState<string>(initial?.startAt ? new Date(initial.startAt).toISOString().slice(0, 16) : "");
  const [endAt, setEndAt] = useState<string>(initial?.endAt ? new Date(initial.endAt).toISOString().slice(0, 16) : "");
  const initialProductIds = initial?.products?.map((p:any)=>p.productId) || [];
  const [productIds, setProductIds] = useState<string[]>(initialProductIds);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  function toggleProduct(pid: string) {
    setProductIds(function(curr){
      if (curr.includes(pid)) { return curr.filter(function(x){ return x !== pid; }); }
      return [...curr, pid];
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const payload: any = {
      code: code.toUpperCase().trim(),
      type: type,
      value: Number(value),
      active: active,
      maxUses: maxUses.trim() === "" ? null : Number(maxUses),
      startAt: startAt ? new Date(startAt).toISOString() : null,
      endAt: endAt ? new Date(endAt).toISOString() : null,
      productIds: productIds,
    };
    try {
      const url = id ? `/api/admin/coupons/${id}` : "/api/admin/coupons";
      const method = id ? "PATCH" : "POST";
      const r = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) {
        const list = j.errors || [j.error || "Gagal"];
        setError(list.join(" • "));
        return;
      }
      router.push("/admin/coupons");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!id) return;
    if (!confirm("Hapus kupon ini (hanya jika belum pernah dipakai)?")) return;
    const r = await fetch(`/api/admin/coupons/${id}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json();
      setError(j.error);
      return;
    }
    router.push("/admin/coupons");
  }

  return (
    <form onSubmit={submit} style={{display:"flex",flexDirection:"column",gap:14}}>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="cards" style={{gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))"}}>
        <div className="card">
          <div className="field">
            <label>Kode Kupon</label>
            <input required placeholder="DISKON10" value={code} onChange={function(e){ setCode(e.target.value); }}/>
          </div>
          <div className="field">
            <label>Jenis Diskon</label>
            <select value={type} onChange={function(e){ setType(e.target.value); }}>
              <option value="PERCENT">Persen (%)</option>
              <option value="FIXED">Rupiah Tetap (Rp)</option>
            </select>
          </div>
          <div className="field">
            <label>Nilai</label>
            <input type="number" min={0} value={value} onChange={function(e){ setValue(Number(e.target.value)); }}/>
            <small className="muted">{type==="PERCENT"?"Rentang 0–100 (%)":"Nilai minimum 0 (Rupiah)"}</small>
          </div>
          <div className="field">
            <label>Maksimal Pemakaian (opsional)</label>
            <input placeholder="Kosong = tanpa batas" value={maxUses} onChange={function(e){ setMaxUses(e.target.value); }}/>
          </div>
        </div>
        <div className="card">
          <div className="field">
            <label>
              <input type="checkbox" checked={active} onChange={function(e){ setActive(e.target.checked); }}/> Aktifkan kupon
            </label>
          </div>
          <div className="field">
            <label>Mulai Berlaku</label>
            <input type="datetime-local" value={startAt} onChange={function(e){ setStartAt(e.target.value); }}/>
          </div>
          <div className="field">
            <label>Berlaku Sampai</label>
            <input type="datetime-local" value={endAt} onChange={function(e){ setEndAt(e.target.value); }}/>
          </div>
          <div className="field">
            <label>Batasi ke Produk Tertentu</label>
            <small className="muted">Kosongkan = berlaku ke semua produk</small>
            <div style={{maxHeight:220,overflow:"auto",border:"1px solid #e3ebe6",borderRadius:10,padding:10}}>
              {(products || []).map(function(p:any){
                return (
                  <label key={p.id} style={{display:"flex",gap:8,padding:"4px 0"}}>
                    <input type="checkbox" checked={productIds.includes(p.id)} onChange={function(){ toggleProduct(p.id); }}/>
                    <span>{p.name} <small className="muted">— {p.type}</small></span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <a className="btn btn-ghost" href="/admin/coupons">Batal</a>
        {id && <button type="button" className="btn btn-ghost" style={{color:"#b42318",borderColor:"#f2d2cf"}} onClick={remove}>Hapus Kupon</button>}
        <button type="submit" className="btn btn-primary" disabled={loading}>{loading?"Menyimpan...":(id?"Simpan Perubahan":"Buat Kupon")}</button>
      </div>
    </form>
  );
}
