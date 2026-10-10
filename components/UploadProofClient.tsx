"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function UploadProofClient({orderId, status, proofSubmittedAt, expiresAt, invoiceExisting, transferAccountExisting, notesExisting}: {
  orderId: string; status: string; proofSubmittedAt: string | null | undefined; expiresAt: string | null | undefined;
  invoiceExisting: string | null | undefined; transferAccountExisting: string | null | undefined; notesExisting: string | null | undefined;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const expired = expiresAt && new Date(expiresAt) < new Date();
  const canUpload = status === "PENDING" && !expired;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const fd = new FormData(e.currentTarget);
      const r = await fetch(`/api/orders/${orderId}/proof`, { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) { setError(j.error || "Gagal."); return; }
      router.push(`/dashboard/orders?sent=1`);
      router.refresh();
    } catch { setError("Koneksi gagal."); } finally { setLoading(false); }
  }
  return (<form onSubmit={submit} style={{display:"flex",flexDirection:"column",gap:12}}>
    {error && <div className="alert alert-error">{error}</div>}
    {expired && status === "PENDING" && <div className="alert alert-error">Tenggat invoice ini telah lewat. Silakan buat order baru.</div>}
    {invoiceExisting && <div className="alert alert-info">Bukti sebelumnya sudah tersimpan di sistem. Anda dapat mengganti unggahan selama status PENDING.</div>}
    <div className="field">
      <label>Rekening pengirim / nama pemilik</label>
      <input name="transferAccount" defaultValue={transferAccountExisting || ""} required placeholder="Contoh: BCA 1234 a.n. Budi"/>
    </div>
    <div className="field">
      <label>Bukti transfer</label>
      <input name="proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required disabled={!canUpload}/>
      <small className="muted">JPG, PNG, WebP, atau PDF. Maksimal 2 MB.</small>
    </div>
    <div className="field">
      <label>Catatan (opsional)</label>
      <textarea name="notes" rows={3} defaultValue={notesExisting || ""} placeholder="Informasi tambahan untuk admin"/>
    </div>
    <button className="btn btn-primary btn-block" disabled={loading || !canUpload}>{loading ? "Mengirim..." : (proofSubmittedAt ? "Perbarui Bukti" : "Kirim Bukti Pembayaran")}</button>
  </form>);
}
