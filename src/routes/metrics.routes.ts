import { Router, Request, Response, NextFunction } from "express";
import prisma from "../config/db";
import createResponse from "../utils/response";

const router = Router();

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [totalProducts, reservationGroups, expiredToday] = await Promise.all([
      prisma.product.count(),
      prisma.reservation.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.reservation.count({
        where: { status: "EXPIRED", createdAt: { gte: startOfToday } },
      }),
    ]);

    const counts: Record<string, number> = {
      PENDING: 0,
      COMPLETED: 0,
      EXPIRED: 0,
      CANCELLED: 0,
    };
    for (const group of reservationGroups) {
      counts[group.status] = group._count.id;
    }

    return res.status(200).json(
      createResponse({
        success: true,
        status: 200,
        message: "Metrics retrieved",
        data: {
          products: { total: totalProducts },
          reservations: { ...counts, expiredToday },
        },
      }),
    );
  } catch (error) {
    next(error);
  }
});

export default router;
