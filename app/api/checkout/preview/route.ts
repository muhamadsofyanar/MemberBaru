import {z} from "zod";import {db} from "@/lib/db";import {handle,apiUser} from "@/lib/api";import {buildOrderPreview} from "@/lib/pricing";

const schema = z.object({
  productMainId: z.string().min(1),
  bumpOfferId: z.string().nullable().optional(),
  couponCode: z.string().trim().max(40).nullable().optional(),
});

export async function POST(req:Request){return handle(async()=>{
  const user = await apiUser();
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if(!parsed.success) return Response.json({error: parsed.error.issues.map(i=> (i.path.join(".")||"input") + ": " + i.message).join(" • ")},{status:400});
  const {productMainId, bumpOfferId, couponCode} = parsed.data;
  const main = await db.product.findUnique({where:{id:productMainId},select:{id:true,status:true,type:true}});
  if(!main || main.status!=="PUBLISHED") return Response.json({error:"Produk tidak tersedia."},{status:404});
  const preview = await buildOrderPreview({userId:user.id,productMainId,bumpOfferId:bumpOfferId||undefined,couponCode:couponCode||undefined});
  return preview;
});}
