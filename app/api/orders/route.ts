import {db} from "@/lib/db";
import {apiUser,handle,ApiError} from "@/lib/api";
import {randomUUID} from "node:crypto";
export async function POST(req:Request){return handle(async()=>{
 const user=await apiUser();const form=await req.formData();const planId=String(form.get("planId")||"");const proof=form.get("proof");
 if(!(proof instanceof File)||proof.size===0||proof.size>2*1024*1024)throw new ApiError("Bukti pembayaran wajib diisi dan maksimal 2 MB.");
 if(!["image/jpeg","image/png","image/webp","application/pdf"].includes(proof.type))throw new ApiError("Format bukti tidak didukung.");
 const transferAccount=String(form.get("transferAccount")||"").trim();if(transferAccount.length<3||transferAccount.length>200)throw new ApiError("Isi rekening atau nama pengirim (3–200 karakter).");
 const bytes=Buffer.from(await proof.arrayBuffer());
 const valid=proof.type==="application/pdf"?bytes.subarray(0,5).toString()==="%PDF-":proof.type==="image/png"?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):proof.type==="image/jpeg"?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.subarray(0,4).toString()==="RIFF"&&bytes.subarray(8,12).toString()==="WEBP";
 if(!valid)throw new ApiError("Isi berkas tidak sesuai format bukti.");
 await db.$transaction(async tx=>{
  const plan=await tx.plan.findFirst({where:{id:planId,isActive:true}});if(!plan)throw new ApiError("Paket tidak ditemukan.",404);
  if(await tx.order.findFirst({where:{userId:user.id,planId,status:"PENDING"}}))throw new ApiError("Pembayaran paket ini sedang menunggu verifikasi.",409);
  await tx.order.create({data:{invoice:`RZ-${randomUUID()}`,userId:user.id,planId,amount:plan.price,durationDaysSnapshot:plan.durationDays,affiliatePercentSnapshot:plan.affiliatePercent,paymentProof:`data:${proof.type};base64,${bytes.toString("base64")}`,transferAccount,notes:String(form.get("notes")||"").slice(0,500)}});
 },{isolationLevel:"Serializable"});
 return {ok:true};
});}
