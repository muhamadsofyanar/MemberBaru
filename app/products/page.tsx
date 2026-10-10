import Link from "next/link"; import { db } from "@/lib/db"; import { rupiah } from "@/lib/utils";
const TYPE_LABEL: Record<string, string> = { EBOOK: "E-Book", TEMPLATE: "Template", COURSE: "Kursus Mandiri", MEMBERSHIP: "Membership", BUNDLE: "Bundel Spesial" };
export default async function Catalog() {
  const products = await db.product.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ type: "asc" }, { price: "asc" }], include: { plan: true, course: true, _count: { select: { assets: true, bundleOf: true } } } });
  const groups = new Map<string, typeof products>();
  for (const p of products) {
    if (!groups.has(p.type)) groups.set(p.type, []);
    groups.get(p.type)!.push(p);
  }
  return (<main><section className="hero"><div className="container"><div className="eyebrow">Toko digital RizqHub</div><h1>Katalog Produk</h1><p className="hero-copy">Panduan, template kerja, dan kursus mandiri untuk mempercepat perjalanan digital Anda. Semua diverifikasi &amp; didukung layanan manual admin.</p></div></section>
  {!products.length && <section className="section"><div className="container"><p className="muted">Belum ada produk yang diterbitkan. Silakan kembali nanti.</p></div></section>}
  {[...groups.entries()].map(([type, rows]) => (<section key={type} className="section section-white"><div className="container"><div className="section-head"><span className="eyebrow">Kategori</span><h2>{TYPE_LABEL[type] || type}</h2><p>{rows.length} produk tersedia.</p></div><div className="cards" style={{gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))"}}>{rows.map(p=>(<article key={p.id} className="card" style={{display:"flex",flexDirection:"column",gap:10}}>{p.thumbnail ? <img src={p.thumbnail} alt={p.name} style={{maxHeight:200,objectFit:"cover",borderRadius:10,width:"100%"}}/> : <div className="brand brand-light" style={{height:140,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center"}}>{TYPE_LABEL[p.type] || "Produk"}</div>}<h3 style={{margin:0}}>{p.name}</h3><p className="muted" style={{minHeight:60}}>{p.description.length > 140 ? p.description.slice(0, 140) + "…" : p.description}</p><div style={{marginTop:"auto",display:"flex",justifyContent:"space-between",alignItems:"center"}}><b style={{fontSize:18}}>{rupiah(p.price)}</b><Link className="btn btn-primary btn-sm" href={`/products/${p.slug}`}>Lihat detail →</Link></div></article>))}</div></div></section>))}</main>);
}
