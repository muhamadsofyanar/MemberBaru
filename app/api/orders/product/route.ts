import {z} from "zod";import {handle,apiUser} from "@/lib/api";import {buildAndSaveOrder} from "@/lib/pricing";

const schema = z.object({
  productMainId: z.string().min(1),
  bumpOfferId: z.string().nullable().optional(),
  couponCode: z.string().trim().max(40).nullable().optional(),
  idempotencyKey: z.string().min(4).max(80),
});

export async function POST(req:Request){return handle(async()=>{
  const user = await apiUser();
  const body = await req.json();
  const {productMainId, bumpOfferId, couponCode, idempotencyKey} = schema.parse(body);
  const result = await buildAndSaveOrder({
    userId: user.id,
    productMainId,
    bumpOfferId: bumpOfferId || undefined,
    couponCode: couponCode || undefined,
    idempotencyKey,
  });
  return result;
});}
