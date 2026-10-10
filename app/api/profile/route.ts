import {verifyPassword} from "@/lib/password";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { apiUser, handle, ApiError, rateLimit } from "@/lib/api";
import { passwordSchema } from "@/lib/business";
import { createSession } from "@/lib/auth";
export async function PATCH(req:Request){return handle(async()=>{
 const user=await apiUser();const body=await req.json();
 if(body.action==="password"){
  await rateLimit(`password:${user.id}`);
  const data=z.object({currentPassword:z.string().min(1),password:passwordSchema}).parse(body);
  if(!await verifyPassword(data.currentPassword,user.passwordHash))throw new ApiError("Password lama salah.");
  const hash=await bcrypt.hash(data.password,12);
  await db.$transaction(async tx=>{
   const changed=await tx.user.updateMany({where:{id:user.id,passwordHash:user.passwordHash},data:{passwordHash:hash,sessionVersion:{increment:1}}});
   if(!changed.count)throw new ApiError("Password berubah. Silakan masuk kembali.",409);
   await tx.passwordReset.deleteMany({where:{userId:user.id}});
  });
  await createSession(user.id);
 }else{
  const data=z.object({name:z.string().trim().min(3).max(100),phone:z.string().trim().regex(/^\+?[0-9]{9,18}$/, "Nomor telepon tidak valid.")}).parse(body);
  await db.user.update({where:{id:user.id},data});
 }
 return {ok:true};
});}
