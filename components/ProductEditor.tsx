"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
const STATUS = ["DRAFT", "PUBLISHED", "ARCHIVED"];
const TYPES = ["EBOOK", "TEMPLATE", "COURSE", "MEMBERSHIP", "BUNDLE"];
export function ProductEditor({initial, courses, plans, assets, bundleOf, bumps}: any) {
  const router = useRouter();
  const id = initial?.id;
  const [status, setStatus] = useState<any>(initial?.status || "DRAFT");
  const [type, setType] = useState<any>(initial?.type || "EBOOK");
  const [name, setName] = useState<string>(initial?.name || "");
  const [slug, setSlug] = useState<string>(initial?.slug || "");
  const [price, setPrice] = useState<number>(initial?.price || 0);
  const [affiliatePercent, setAffiliatePercent] = useState<number>(initial?.affiliatePercent ?? 20);
  const [description, setDescription] = useState<string>(initial?.description || "");
  const [thumbnail, setThumbnail] = useState<string>(initial?.thumbnail || "");
  const [legacyPlanId, setLegacyPlanId] = useState<string>(initial?.legacyPlanId || "");
  const [courseId, setCourseId] = useState<string>(initial?.courseId || "");
  const [featuresStr, setFeaturesStr] = useState<string>(initial?.features ? JSON.stringify(initial.features, null, 2) : "[]");
  const [faqStr, setFaqStr] = useState<string>(initial?.faq ? JSON.stringify(initial.faq, null, 2) : "[]");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const fd = new FormData();
      fd.set("name", name);
      if (slug.trim()) fd.set("slug", slug);
      fd.set("status", status);
      fd.set("type", type);
      fd.set("price", String(price));
      fd.set("affiliatePercent", String(affiliatePercent));
      fd.set("description", description);
      fd.set("thumbnail", thumbnail);
      if (legacyPlanId) fd.set("legacyPlanId", legacyPlanId);
      if (courseId) fd.set("courseId", courseId);
      fd.set("features", featuresStr);
      fd.set("faq", faqStr);
      const url = id ? `/api/admin/products/${id}` : "/api/admin/products";
      const r = await fetch(url, { method: id ? "PATCH" : "POST", body: fd });
      const j = await r.json();
      if (!r.ok) { setError((j.errors || [j.error || "Gagal"]).join(" • ")); return; }
      if (j.warning) alert(j.warning);
      router.push("/admin/products");
      router.refresh();
    } catch { setError("Koneksi gagal."); } finally { setLoading(false); }
  }

  async function uploadAssets() {
    if (!id) return;
    setUploading(true); setError("");
    try {
      for (const f of files) {
        const fd = new FormData();
        fd.set("meta", JSON.stringify({ name: f.name, kind: "MAIN_FILE", description: "Unggah dari admin" }));
        fd.set("file", f);
        const r = await fetch(`/api/admin/products/${id}/assets`, { method: "POST", body: fd });
        const j = await r.json();
        if (!r.ok) setError((j.errors || [j.error || "Gagal upload"]).join(" • "));
      }
      setFiles([]); router.refresh();
    } finally { setUploading(false); }
  }

  async function removeAsset(assetId: string) {
    if (!confirm("Hapus asset ini?")) return;
    const r = await fetch(`/api/admin/products/assets/${assetId}`, { method: "DELETE" });
    if (!r.ok) { const j = await r.json(); setError(j.error); return; }
    router.refresh();
  }

  async function removeProduct() {
    if (!id || !confirm("Hapus produk ini (hanya jika belum ada transaksi)?")) return;
    const r = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    if (!r.ok) { const j = await r.json(); setError(j.error); return; }
    router.push("/admin/products");
  }

  return (<form onSubmit={submit} style={{display:"flex",flexDirection:"column",gap:14}}>
    {error && <div className="alert alert-error">{error}</div>}
    <div className="cards" style={{gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))"}}>
      <div className="card">
        <div className="field"><label>Jenis produk</label>
          <select value={type} onChange={e=>setType(e.target.value as any)}>{TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select>
        </div>
        <div className="field"><label>Status</label>
          <select value={status} onChange={e=>setStatus(e.target.value as any)}>{STATUS.map(t=><option key={t} value={t}>{t}</option>)}</select>
        </div>
        <div className="field"><label>Nama produk</label><input required value={name} onChange={e=>setName(e.target.value)}/></div>
        <div className="field"><label>Slug (opsional; kosongkan untuk buat otomatis)</label><input value={slug} onChange={e=>setSlug(e.target.value)}/></div>
        <div className="field"><label>Harga (Rp)</label><input type="number" min={1} required value={price} onChange={e=>setPrice(Number(e.target.value))}/></div>
        <div className="field"><label>Affiliate %</label><input type="number" min={0} max={100} value={affiliatePercent} onChange={e=>setAffiliatePercent(Number(e.target.value))}/></div>
      </div>
      <div className="card">
        <div className="field"><label>Deskripsi</label><textarea rows={6} required value={description} onChange={e=>setDescription(e.target.value)}/></div>
        <div className="field"><label>URL Cover Image (opsional)</label><input value={thumbnail} onChange={e=>setThumbnail(e.target.value)}/></div>
        {type === "MEMBERSHIP" && <div className="field"><label>Paket (Plan) yang mewakili produk ini</label>
          <select value={legacyPlanId} onChange={e=>setLegacyPlanId(e.target.value)}><option value="">— belum dihubungkan —</option>{plans.map((p:any)=><option key={p.id} value={p.id}>{p.name} ({p.durationDays} hari)</option>)}</select>
        </div>}
        {type === "COURSE" && <div className="field"><label>Kursus LMS yang akan dijual</label>
          <select value={courseId} onChange={e=>setCourseId(e.target.value)}><option value="">— pilih kursus —</option>{courses.map((c:any)=><option key={c.id} value={c.id}>{c.title}{c.isPublished?"":" [DRAFT]"}</option>)}</select>
        </div>}
      </div>
    </div>
    <div className="cards" style={{gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)"}}>
      <div className="panel"><h3>Fitur (JSON array string[] atau object[])</h3><textarea rows={8} value={featuresStr} onChange={e=>setFeaturesStr(e.target.value)} style={{fontFamily:"ui-monospace,monospace"}}/></div>
      <div className="panel"><h3>FAQ (JSON array objek q, a)</h3><textarea rows={8} value={faqStr} onChange={e=>setFaqStr(e.target.value)} style={{fontFamily:"ui-monospace,monospace"}}/></div>
    </div>
    {id && <div className="panel"><h3>Asset Produk (PDF / ZIP, maks 50 MiB per file)</h3>
    {assets && assets.length > 0 && <table className="table"><thead><tr><th>Nama berkas</th><th>Ukuran</th><th>Tipe</th><th>Diupload</th><th>Aksi</th></tr></thead><tbody>
      {assets.map((a:any)=>(<tr key={a.id}><td>{a.originalName}</td><td>{(a.size/1024).toFixed(1)} KB</td><td>{a.mime}</td><td>{new Date(a.createdAt).toLocaleString("id-ID")}</td><td><button type="button" className="btn btn-ghost btn-sm" onClick={()=>removeAsset(a.id)}>Hapus</button></td></tr>))}
    </tbody></table>}
    <div className="field" style={{marginTop:12}}><label>Tambah asset</label><input type="file" accept="application/pdf,application/zip,application/x-zip-compressed,application/octet-stream,.pdf,.zip" multiple onChange={e=>{if(e.target.files)setFiles(Array.from(e.target.files));}}/></div>
    <div style={{display:"flex",gap:8,alignItems:"center"}}><button type="button" className="btn btn-primary btn-sm" disabled={uploading || files.length===0} onClick={uploadAssets}>{uploading?"Mengunggah...":"Unggah Asset"}</button><span className="muted">{files.length} file dipilih</span></div>
    </div>}
    <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
      <Link className="btn btn-ghost" href="/admin/products">Batal</Link>
      {id && <button type="button" className="btn btn-ghost" style={{color:"#b42318",borderColor:"#f2d2cf"}} onClick={removeProduct}>Hapus Produk</button>}
      <button type="submit" className="btn btn-primary" disabled={loading}>{loading?"Menyimpan...":(id?"Simpan Perubahan":"Buat Produk")}</button>
    </div>
  </form>);
}
