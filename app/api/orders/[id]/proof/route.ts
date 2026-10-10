import {db} from "@/lib/db";import {apiUser,handle,ApiError} from "@/lib/api";

const MAX_PROOF = 2 * 1024 * 1024;
const ALLOWED = ["image/jpeg","image/png","image/webp","application/pdf"];

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){return handle(async()=>{
  const user = await apiUser();
  const {id} = await params;
  const now = new Date();
  const order = await db.order.findUnique({where:{id},include:{couponReservation:true}});
  if(!order) throw new ApiError("Invoice tidak ditemukan.",404);
  if(order.userId !== user.id) throw new ApiError("Akses ditolak.",403);
  if(order.status!=="PENDING") throw new ApiError(`Invoice status ${order.status}, tidak dapat menambah bukti.`,400);
  if(order.expiresAt && order.expiresAt < now) throw new ApiError("Tenggat invoice sudah lewat. Hubungi admin untuk bantuan.",400);
  const form = await req.formData();
  const proof = form.get("proof");
  if(!(proof instanceof File)||proof.size===0||proof.size>MAX_PROOF) throw new ApiError("Bukti pembayaran wajib diisi dan maksimal 2 MB.");
  if(!ALLOWED.includes(proof.type)) throw new ApiError("Format bukti tidak didukung.");
  const bytes=Buffer.from(await proof.arrayBuffer());
  const valid=proof.type==="application/pdf"?bytes.subarray(0,5).toString()==="%PDF-":proof.type==="image/png"?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):proof.type==="image/jpeg"?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.subarray(0,4).toString()==="RIFF"&&bytes.subarray(8,12).toString()==="WEBP";
  if(!valid) throw new ApiError("Isi berkas tidak sesuai format bukti.");
  const transferAccount=String(form.get("transferAccount")||"").trim();if(transferAccount.length<3||transferAccount.length>200)throw new ApiError("Isi rekening atau nama pengirim (3–200 karakter).");
  const upd: any = {
    paymentProof:`data:${proof.type};base64,${bytes.toString("base64")}`,
    transferAccount,
    notes:String(form.get("notes")||"").slice(0,500),
  };
  if(!order.proofSubmittedAt) upd.proofSubmittedAt = now;
  if(order.couponReservation && order.expiresAt && order.expiresAt > now) {
  }
  await db.order.update({where:{id},data:upd});
  return {ok:true};
});}
