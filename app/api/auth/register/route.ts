import bcrypt from "bcryptjs";import {z} from "zod";import {db} from "@/lib/db";import {createSession} from "@/lib/auth";import {makeReferralCode} from "@/lib/utils";import {passwordSchema} from "@/lib/business";import {handle,rateLimit,ApiError} from "@/lib/api";
const schema=z.object({name:z.string().trim().min(3).max(100),email:z.string().trim().toLowerCase().email().max(254),phone:z.string().trim().regex(/^\+?[0-9]{9,18}$/, "Nomor telepon tidak valid."),password:passwordSchema,ref:z.string().max(100).optional(),plan:z.string().regex(/^[a-z0-9-]*$/).max(100).optional()});
export async function POST(req:Request){return handle(async()=>{
 const data=schema.parse(await req.json());await rateLimit(`register:${data.email}`,5);await rateLimit("register:global",100);
 if(await db.user.findUnique({where:{email:data.email}}))throw new ApiError("Email sudah terdaftar.",409);
 const referrer=data.ref?await db.user.findUnique({where:{referralCode:data.ref.toUpperCase()}}):null;
 let code=makeReferralCode(data.name);while(await db.user.findUnique({where:{referralCode:code}}))code=makeReferralCode(data.name);
 const user=await db.user.create({data:{name:data.name,email:data.email,phone:data.phone,passwordHash:await bcrypt.hash(data.password,12),referralCode:code,referredById:referrer?.isActive?referrer.id:null}});
 await createSession(user.id);return {ok:true,redirect:data.plan?`/checkout/${data.plan}`:"/dashboard"};
});}
