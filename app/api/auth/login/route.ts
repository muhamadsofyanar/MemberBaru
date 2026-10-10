import {verifyPassword} from "@/lib/password";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { handle, ApiError, rateLimit } from "@/lib/api";
export async function POST(req:Request){return handle(async()=>{
 const data=z.object({email:z.string().trim().toLowerCase().email(),password:z.string().min(1).max(200)}).parse(await req.json());
 await rateLimit(`login:${data.email}`,10);
 const user=await db.user.findUnique({where:{email:data.email}});
 if(!user?.isActive||!await verifyPassword(data.password,user.passwordHash))throw new ApiError("Email atau password salah.",401);
 await createSession(user.id);return {ok:true,redirect:user.role==="ADMIN"?"/admin":"/dashboard"};
});}
