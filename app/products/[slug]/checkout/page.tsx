import { notFound } from "next/navigation"; import { requireUser } from "@/lib/auth"; import { db } from "@/lib/db"; import { rupiah } from "@/lib/utils"; import { ProductCheckoutClient } from "@/components/ProductCheckoutClient";
export default async function ProductCheckoutPage({params}:{params:Promise<{slug:string}>}) {
  await requireUser();
  const {slug}=await params;
  const product = await db.product.findUnique({where:{slug},include:{bumps:{include:{bumpOffer:{select:{id:true,name:true,price:true,status:true,type:true}}}}}});
  if(!product||product.status!=="PUBLISHED") return notFound();
  const settings = Object.fromEntries((await db.setting.findMany()).map(s=>[s.key,s.value]));
  const bumps = product.bumps.map(b => b.bumpOffer).filter(Boolean) as any[];
  return (<main className="auth-shell"><div className="auth-card" style={{maxWidth:620}}>
    <span className="eyebrow">Checkout produk</span>
    <h1 style={{marginBottom:6}}>{product.name}</h1>
    <p className="muted" style={{marginBottom:16}}>Harga dasar: <b>{rupiah(product.price)}</b>. Setelah order dibuat, Anda harus mengirim bukti sebelum tenggat agar diverifikasi admin.</p>
    <div className="panel" style={{margin:"10px 0 14px",background:"#f5faf7"}}>
      <div className="stack"><span className="muted">Transfer ke rekening:</span>
      <b>{settings.bank_name||"Rekening belum diatur"}</b>
      <span className="code-box">{settings.bank_account||"-"}</span>
      <b>a.n. {settings.bank_holder||"-"}</b></div>
    </div>
    <ProductCheckoutClient productMainId={product.id} bumpOptions={bumps} defaultTotal={product.price}/>
  </div></main>);
}
