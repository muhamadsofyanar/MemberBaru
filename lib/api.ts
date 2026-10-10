import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getSessionUser } from "./auth";
import { db } from "./db";
import { createHash } from "node:crypto";
export class ApiError extends Error { constructor(message: string, public status=400) {super(message);} }
export async function apiUser(admin=false) {
 const user=await getSessionUser();
 if(!user) throw new ApiError("Silakan masuk kembali.",401);
 if(admin && user.role!=="ADMIN") throw new ApiError("Akses ditolak.",403);
 return user;
}
export async function handle(work:()=>Promise<unknown>) {
 try {return NextResponse.json(await work());}
 catch(e) {
  if(e instanceof ApiError) return NextResponse.json({error:e.message},{status:e.status});
  if(e instanceof z.ZodError) return NextResponse.json({error:e.issues[0]?.message || "Data tidak valid."},{status:400});
  if(e instanceof SyntaxError) return NextResponse.json({error:"Data tidak valid."},{status:400});
  if(e instanceof Prisma.PrismaClientKnownRequestError && ["P2002","P2003","P2025","P2034"].includes(e.code)) return NextResponse.json({error:"Data berubah atau sudah digunakan. Muat ulang dan coba lagi."},{status:409});
  console.error("Request failed", e instanceof Error ? e.name : "unknown");
  return NextResponse.json({error:"Permintaan gagal diproses."},{status:500});
 }
}
export async function rateLimit(key:string, limit=8, minutes=15) {
 const hash=createHash("sha256").update(key).digest("hex");
 const rows=await db.$queryRaw<{hits:number}[]>`INSERT INTO "RateLimit" ("key", "hits", "expiresAt") VALUES (${hash}, 1, ${new Date(Date.now()+minutes*60000)}) ON CONFLICT ("key") DO UPDATE SET "hits" = CASE WHEN "RateLimit"."expiresAt" < NOW() THEN 1 ELSE "RateLimit"."hits" + 1 END, "expiresAt" = CASE WHEN "RateLimit"."expiresAt" < NOW() THEN EXCLUDED."expiresAt" ELSE "RateLimit"."expiresAt" END RETURNING "hits"`;
 if(rows[0].hits>limit) throw new ApiError("Terlalu banyak percobaan. Coba lagi dalam 15 menit.",429);
}
