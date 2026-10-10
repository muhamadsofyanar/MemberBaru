import { NextResponse } from "next/server"; import { requireAdmin } from "@/lib/auth"; import { db } from "@/lib/db";
const allowed=["site_name","bank_name","bank_account","bank_holder","whatsapp_admin"];
export async function PUT(req:Request){await requireAdmin();const data=await req.json();for(const key of allowed){const value=String(data[key]||"").trim().slice(0,200);await db.setting.upsert({where:{key},update:{value},create:{key,value}})}return NextResponse.json({ok:true})}
