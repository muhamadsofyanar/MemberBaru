import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, ApiError, rateLimit } from "@/lib/api";
import { passwordSchema } from "@/lib/business";
export async function POST(req:Request){return handle(async()=>{
 const data=z.object({token:z.string().regex(/^[a-f0-9]{64}$/),password:passwordSchema}).parse(await req.json());
 await rateLimit(`reset-token:${data.token}`,5);
 const tokenHash=createHash("sha256").update(data.token).digest("hex");
 const hash=await bcrypt.hash(data.password,12);
 await db.$transaction(async tx=>{
  const reset=await tx.passwordReset.findUnique({where:{tokenHash}});
  if(!reset||reset.expiresAt<=new Date())throw new ApiError("Tautan sudah kedaluwarsa atau tidak valid.");
  const consumed=await tx.passwordReset.deleteMany({where:{id:reset.id,expiresAt:{gt:new Date()}}});
  if(!consumed.count)throw new ApiError("Tautan sudah digunakan.",409);
  await tx.user.update({where:{id:reset.userId},data:{passwordHash:hash,sessionVersion:{increment:1}}});
  await tx.passwordReset.deleteMany({where:{userId:reset.userId}});
 });
 return {ok:true};
});}
