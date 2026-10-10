import { NextRequest, NextResponse } from "next/server";
export function middleware(req: NextRequest) {
 if (!["GET","HEAD","OPTIONS"].includes(req.method)) {
  const origin=req.headers.get("origin");
  const expected=process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin : req.nextUrl.origin;
  if(req.headers.get("sec-fetch-site")==="cross-site" || (origin && origin!==expected)) return NextResponse.json({error:"Asal permintaan tidak diizinkan."},{status:403});
 }
 const res=NextResponse.next();
 res.headers.set("X-Content-Type-Options","nosniff");
 res.headers.set("X-Frame-Options","DENY");
 res.headers.set("Referrer-Policy","same-origin");
 return res;
}
export const config={matcher:["/api/:path*"]};
