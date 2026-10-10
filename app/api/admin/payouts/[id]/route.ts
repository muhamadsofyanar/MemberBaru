import {z} from "zod";import {db} from "@/lib/db";import {handle,apiUser,ApiError} from "@/lib/api";import {payoutTransition} from "@/lib/business";
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){return handle(async()=>{
 const admin=await apiUser(true);const {id}=await params;const data=z.object({status:z.enum(["APPROVED","REJECTED","PAID"]),reviewNote:z.string().trim().max(500).optional(),transferReference:z.string().trim().max(200).optional()}).parse(await req.json());
 if(data.status==="PAID"&&!data.transferReference)throw new ApiError("Isi referensi transfer sebelum menandai lunas.");
 if(data.status==="REJECTED"&&!data.reviewNote)throw new ApiError("Isi alasan penolakan.");
 await db.$transaction(async tx=>{
  const payout=await tx.payout.findUnique({where:{id}});if(!payout)throw new ApiError("Pengajuan tidak ditemukan.",404);
  if(!payoutTransition(payout.status,data.status))throw new ApiError("Perubahan status tidak diizinkan.",409);
  const changed=await tx.payout.updateMany({where:{id,status:payout.status},data:{status:data.status,reviewNote:data.reviewNote,transferReference:data.transferReference,reviewedById:admin.id,reviewedAt:new Date(),paidAt:data.status==="PAID"?new Date():null}});
  if(!changed.count)throw new ApiError("Pengajuan sudah diproses.",409);
  if(data.status==="REJECTED")await tx.commission.updateMany({where:{payoutId:id,status:"APPROVED"},data:{payoutId:null}});
  if(data.status==="PAID")await tx.commission.updateMany({where:{payoutId:id,status:"APPROVED"},data:{status:"PAID",paidAt:new Date()}});
 },{isolationLevel:"Serializable"});
 return {ok:true};
});}
