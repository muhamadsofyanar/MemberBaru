import {issueSoftwareLicenses} from "@/lib/software-license";
import {z} from "zod";import {db, PRISMA_SERIALIZABLE, isConflict} from "@/lib/db";import {handle,apiUser,ApiError} from "@/lib/api";import {membershipWindow, allocateCommission} from "@/lib/business";import {sendOrderNotification} from "@/lib/notify";

async function approveOrder(tx: any, id: string, status: "PAID" | "REJECTED", forceLegacy=false) {
  const now = new Date();
  const changed = await tx.order.updateMany({
    where: { id, status: "PENDING" as const },
    data: { status, reviewedAt: now, paidAt: status === "PAID" ? now : null },
  });
  if (!changed.count) throw new ApiError("Transaksi sudah diproses.", 409);
  const order = await tx.order.findUnique({
    where: { id },
    include: { user: true, plan: true, items: true, grants: true, couponReservation: true },
  });
  if (!order) throw new ApiError("Order tidak ditemukan.", 404);

  const isLegacy = forceLegacy || order.legacy === true || (!!order.planId && (!order.items || order.items.length === 0));

  if (status === "PAID" && isLegacy) {
    if (!order.planId || !order.plan) {
      throw new ApiError("Order legacy tidak memiliki plan yang valid.", 400);
    }
    const previous = await tx.membership.findFirst({
      where: { userId: order.userId, planId: order.planId as string, status: "ACTIVE" as const, endsAt: { gt: now } },
      orderBy: { endsAt: "desc" },
    });
    const duration = order.durationDaysSnapshot ?? order.plan.durationDays;
    await tx.membership.create({
      data: {
        userId: order.userId,
        planId: order.planId as string,
        orderId: id,
        ...membershipWindow(now, duration, previous?.endsAt ?? null),
      },
    });
    const percent = order.affiliatePercentSnapshot ?? order.plan.affiliatePercent;
    const amount = order.amount ?? 0;
    if (order.user.referredById && order.user.referredById !== order.userId) {
      await tx.commission.create({
        data: {
          affiliateId: order.user.referredById,
          sourceUserId: order.userId,
          orderId: id,
          amount: allocateCommission(amount, percent),
          percent,
          status: "APPROVED" as const,
        },
      });
    }
  } else if (status === "PAID") {
    const planGrants = new Map<string, { durationDays: number | null; grantId: string }>();
    const grantOrderItemPercent = new Map<string, number>();
    for (const item of order.items || []) {
      grantOrderItemPercent.set(item.id, item.affiliatePercent);
    }
    for (const g of order.grants || []) {
      if (g.kind === "PLAN") {
        const exist = planGrants.get(g.grantRefId);
        if (exist) {
          throw new ApiError("Order ini memberikan PLAN yang sama lebih dari sekali. Tidak dapat diproses.", 400);
        }
        planGrants.set(g.grantRefId, { durationDays: g.durationDays ?? null, grantId: g.id });
      }
    }
    for (const [planId, info] of planGrants.entries()) {
      const plan = await tx.plan.findUnique({ where: { id: planId } });
      if (!plan) continue;
      const duration = info.durationDays ?? plan.durationDays;
      const previous = await tx.membership.findFirst({
        where: { userId: order.userId, planId, status: "ACTIVE" as const, endsAt: { gt: now } },
        orderBy: { endsAt: "desc" },
      });
      await tx.membership.create({
        data: {
          userId: order.userId,
          planId,
          orderId: id,
          ...membershipWindow(now, duration, previous?.endsAt ?? null),
        },
      });
    }
    for (const g of order.grants || []) {
      await tx.entitlement.create({
        data: {
          userId: order.userId,
          orderGrantId: g.id,
          kind: g.kind,
          grantRefId: g.grantRefId,
          productId: g.productId ?? null,
        },
      });
    }
    let totalCommission = 0;
    for (const item of order.items || []) {
      const pct = grantOrderItemPercent.get(item.id) ?? 0;
      totalCommission += allocateCommission(item.netPrice, pct);
    }
    if (order.user.referredById && order.user.referredById !== order.userId && totalCommission > 0) {
      await tx.commission.create({
        data: {
          affiliateId: order.user.referredById,
          sourceUserId: order.userId,
          orderId: id,
          amount: totalCommission,
          percent: 0,
          status: "APPROVED" as const,
        },
      });
    }
    if (order.couponReservation) {
      await tx.couponReservation.update({
        where: { id: order.couponReservation.id },
        data: { usedAt: now },
      });
    }
  } else if (status === "REJECTED") {
    if (order.couponReservation && !order.couponReservation.usedAt) {
      await tx.couponReservation.delete({ where: { id: order.couponReservation.id } });
    }
  }
  if(status === "PAID") await issueSoftwareLicenses(tx,order);
  return order;
}

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){return handle(async()=>{
 await apiUser(true);const {id}=await params;const {status}=z.object({status:z.enum(["PAID","REJECTED"])}).parse(await req.json());
 const MAX_RETRY=3; let lastErr: unknown=null; let order: any=null;
 for(let i=0;i<MAX_RETRY;i++){
  try{
   order = await db.$transaction(tx => approveOrder(tx, id, status), PRISMA_SERIALIZABLE);
   break;
  }catch(err){ if(isConflict(err)){ lastErr=err; continue; } throw err; }
 }
 if(!order){ if(lastErr instanceof Error) throw lastErr; throw new ApiError("Sistem sedang sibuk, coba lagi.",500); }
 await sendOrderNotification({to:order.user.phone||"",name:order.user.name,invoice:order.invoice,status});return {ok:true};
});}
