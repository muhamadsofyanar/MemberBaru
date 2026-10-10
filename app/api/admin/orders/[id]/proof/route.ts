import {NextResponse} from "next/server";import {getSessionUser} from "@/lib/auth";import {db} from "@/lib/db";
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 const user=await getSessionUser();if(!user||user.role!=="ADMIN")return NextResponse.json({error:"Akses ditolak."},{status:403});
 const {id}=await params;const order=await db.order.findUnique({where:{id},select:{paymentProof:true}});
 const match=order?.paymentProof?.match(/^data:(image\/jpeg|image\/png|image\/webp|application\/pdf);base64,([A-Za-z0-9+/=]+)$/);
 if(!match)return NextResponse.json({error:"Bukti tidak ditemukan."},{status:404});
 const extensions:Record<string,string>={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","application/pdf":"pdf"};
 return new Response(new Uint8Array(Buffer.from(match[2],"base64")),{headers:{"Content-Type":match[1],"Content-Disposition":`inline; filename="bukti.${extensions[match[1]]}"`,"Cache-Control":"private, no-store","Content-Security-Policy":"sandbox","X-Content-Type-Options":"nosniff"}});
}
