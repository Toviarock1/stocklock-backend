import cron from "node-cron";
import prisma from "../config/db";
import { logger } from "../config/logger";

export function startExpiryJob(): void {
  cron.schedule("* * * * *", async () => {
    try {
      const expired = await prisma.reservation.findMany({
        where: { status: "PENDING", expiresAt: { lt: new Date() } },
        select: { id: true, productId: true, quantity: true },
      });

      if (expired.length === 0) return;

      const results = await Promise.allSettled(
        expired.map(async (r) => {
          await prisma.$transaction(async (tx) => {
            // Guard: reservation may have been checked out before cron ran
            const result = await tx.reservation.updateMany({
              where: { id: r.id, status: "PENDING" },
              data: { status: "EXPIRED" },
            });

            if (result.count === 0) return;

            await tx.product.update({
              where: { id: r.productId },
              data: { availableStock: { increment: r.quantity } },
            });

            await tx.inventoryLog.create({
              data: {
                productId: r.productId,
                change: r.quantity,
                reason: `Reservation ${r.id} expired — stock restored`,
              },
            });
          });
        }),
      );

      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        failed.forEach((r) => {
          if (r.status === "rejected") {
            logger.error(`Expiry cron failed for a reservation: ${r.reason}`);
          }
        });
      }

      logger.info(`Expiry cron: processed ${expired.length} reservation(s)`);
    } catch (err) {
      logger.error(`Expiry cron error: ${err}`);
    }
  });
}
