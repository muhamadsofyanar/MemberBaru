import Link from "next/link"; import { notFound } from "next/navigation"; import { db } from "@/lib/db"; import { rupiah } from "@/lib/utils";
const TYPE_LABEL: Record<string, string> = { EBOOK: "E-Book (PDF)", TEMPLATE: "Template (ZIP)", COURSE: "Kursus Mandiri", MEMBERSHIP: "Paket Membership", BUNDLE: "Bundel" };
export default async function ProductLanding({params}:{params:Promise<{slug:string}>}) {
  const {slug} = await params;
  const product = await db.product.findUnique({ where: { slug }, include: { assets: true, bundleOf: { include: { component: true } }, bumps: { include: { bumpOffer: { select: { id: true, name: true, price: true, status: true, type: true } } } }, plan: true, course: true } });
  if (!product || product.status !== "PUBLISHED") return notFound();
  const features = Array.isArray(product.features) ? product.features as any[] : [];
  const faq = Array.isArray(product.faq) ? product.faq as any[] : [];
  return (<main>
    <section className="hero">
      <div className="container hero-grid" style={{gridTemplateColumns:"minmax(0,1.1fr) minmax(0,1fr)"}}>
        <div>
          <span className="eyebrow">{TYPE_LABEL[product.type] || "Produk"}</span>
          <h1>{product.name}</h1>
          <p className="hero-copy">{product.description}</p>
          <div className="hero-actions">
            <Link href={`/products/${product.slug}/checkout`} className="btn btn-primary">Beli Sekarang — {rupiah(product.price)}</Link>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {product.thumbnail ? (
            <img src={product.thumbnail} alt={product.name} style={{maxWidth:"100%",borderRadius:14,boxShadow:"0 14px 40px rgba(0,0,0,.06)"}}/>
          ) : (
            <div className="brand brand-light" style={{height:280,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:44}}>
              {TYPE_LABEL[product.type] || "Produk"}
            </div>
          )}
          <div className="card">
            <div className="card-label">Termasuk</div>
            <ul className="checks" style={{marginTop:10}}>
              {product.bundleOf && product.bundleOf.length > 0 ? (
                product.bundleOf.map(b => <li key={b.componentId}>{b.component?.name || "Produk"}</li>)
              ) : (<>
                {product.type === "EBOOK" && <li>File PDF seumur hak cipta pemilik</li>}
                {product.type === "TEMPLATE" && <li>Berkas template siap pakai (ZIP)</li>}
                {product.type === "COURSE" && product.course && <li>Akses {product.course.title} (segera setelah diverifikasi)</li>}
                {product.type === "MEMBERSHIP" && product.plan && <li>Paket {product.plan.name} — {product.plan.durationDays} hari</li>}
                <li>Invoice &amp; bukti transfer diverifikasi manual admin</li>
              </>)}
            </ul>
          </div>
        </div>
      </div>
    </section>
    {features.length > 0 && (
      <section className="section section-white">
        <div className="container">
          <div className="section-head"><h2>Fitur &amp; Manfaat</h2></div>
          <div className="cards" style={{gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))"}}>
            {features.map((f: any, i: number) => (
              <article key={i} className="card">
                {typeof f === "string" ? (
                  <p style={{margin:0}}>{f}</p>
                ) : (f && typeof f === "object" ? (
                  <div>
                    <b>{f.title || f.name || "Fitur"}</b>
                    <p className="muted">{f.desc || f.description || ""}</p>
                  </div>
                ) : <p>{String(f)}</p>)}
              </article>
            ))}
          </div>
        </div>
      </section>
    )}
    {faq.length > 0 && (
      <section className="section">
        <div className="container">
          <div className="section-head"><h2>Pertanyaan yang sering ditanyakan</h2></div>
          <div className="faq">
            {faq.map((f: any, i: number) => (
              <details key={i}>
                <summary>{f?.q || f?.question || "Pertanyaan"}</summary>
                <p>{f?.a || f?.answer || f?.desc || ""}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    )}
    <section className="section section-white">
      <div className="container" style={{textAlign:"center",maxWidth:720}}>
        <h2>Siap memulai?</h2>
        <p>Admin akan memverifikasi pembayaran Anda dalam 1x24 jam (hari kerja). Setelah disetujui, akses produk aktif otomatis di dashboard Anda.</p>
        <div className="hero-actions" style={{justifyContent:"center"}}>
          <Link className="btn btn-primary" href={`/products/${product.slug}/checkout`}>Checkout Sekarang</Link>
          <Link className="btn btn-ghost" href="/products">Kembali ke Katalog</Link>
        </div>
      </div>
    </section>
  </main>);
}
