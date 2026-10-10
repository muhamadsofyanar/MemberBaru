import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, rateLimit, ApiError } from "@/lib/api";
import { mailReady, sendResetEmail } from "@/lib/mail";
export async function POST(req:Request){return handle(async()=>{
 const {email}=z.object({email:z.string().trim().toLowerCase().email()}).parse(await req.json());
 if(!mailReady())throw new ApiError("Reset melalui email belum tersedia. Hubungi admin.",503);
 await rateLimit(`reset:${email}`,3);await rateLimit("reset:global",100);
 const user=await db.user.findUnique({where:{email}});
 if(user?.isActive){
  const token=randomBytes(32).toString("hex"); const tokenHash=createHash("sha256").update(token).digest("hex");
  await db.passwordReset.create({data:{userId:user.id,tokenHash,expiresAt:new Date(Date.now()+1800000)}});
  try{await sendResetEmail(email,token);}catch{await db.passwordReset.deleteMany({where:{tokenHash}});console.error("Reset email delivery failed");}
 }
 return {ok:true,message:"Jika email terdaftar, tautan reset akan dikirim. Periksa inbox atau spam."};
});}
