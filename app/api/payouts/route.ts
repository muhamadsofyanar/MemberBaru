import {z} from "zod";import {db} from "@/lib/db";import {handle,apiUser,ApiError} from "@/lib/api";
export async function POST(req:Request){return handle(async()=>{
 const user=await apiUser();const data=z.object({bankName:z.string().trim().min(2).max(100),accountNumber:z.string().trim().regex(/^[0-9]{5,40}$/, "Nomor rekening harus berisi 5–40 digit."),accountName:z.string().trim().min(3).max(100)}).parse(await req.json());
 await db.$transaction(async tx=>{
  if(await tx.payout.findFirst({where:{userId:user.id,status:{in:["PENDING","APPROVED"]}}}))throw new ApiError("Masih ada pengajuan yang sedang diproses.",409);
  const commissions=await tx.commission.findMany({where:{affiliateId:user.id,status:"APPROVED",payoutId:null}});
  const amount=commissions.reduce((n,c)=>n+c.amount,0);if(amount<=0)throw new ApiError("Belum ada saldo komisi yang dapat dicairkan.");
  const payout=await tx.payout.create({data:{...data,userId:user.id,amount}});
  const reserved=await tx.commission.updateMany({where:{id:{in:commissions.map(c=>c.id)},payoutId:null,status:"APPROVED"},data:{payoutId:payout.id}});
  if(reserved.count!==commissions.length)throw new ApiError("Saldo berubah. Silakan coba lagi.",409);
 },{isolationLevel:"Serializable"});
 return {ok:true};
});}
