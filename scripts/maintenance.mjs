import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const [expiredOrders, expiredReservationsCount] = await prisma.$transaction(async tx => {
    const expired = await tx.order.findMany({
      where: {
        status: "PENDING",
        expiresAt: { not: null, lt: now },
      },
      select: { id: true, couponReservation: { select: { id: true } } },
    });
    for (const order of expired) {
      if (order.couponReservation) {
        await tx.couponReservation.delete({ where: { id: order.couponReservation.id } });
      }
    }
    const updated = await tx.order.updateMany({
      where: { id: { in: expired.map(o => o.id) }, status: "PENDING" },
      data: { status: "EXPIRED", reviewedAt: now },
    });
    const orphan = await tx.couponReservation.deleteMany({
      where: {
        order: { status: { notIn: ["PENDING", "PAID"] } },
        usedAt: null,
      },
    });
    return [updated.count, orphan.count];
  });
  console.log(`[maintenance] Expired ${expiredOrders} orders, released ${expiredReservationsCount} orphan coupon reservations.`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
