import prisma from "../config/db";
import { ApiError } from "../utils/ApiError";
import { logger } from "../config/logger";
import { ReserveInput } from "../schemas/reservation.schema";

export const reserveProduct = async (userId: string, input: ReserveInput) => {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: input.productId },
    });

    if (!product) throw new ApiError(404, "Product not found");
    if (product.availableStock < input.quantity) {
      throw new ApiError(409, "Insufficient stock");
    }

    // Optimistic lock: atomically decrement stock only if version still matches
    const updated = await tx.product.updateMany({
      where: {
        id: input.productId,
        version: product.version,
        availableStock: { gte: input.quantity },
      },
      data: {
        availableStock: { decrement: input.quantity },
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      throw new ApiError(
        409,
        "Product unavailable or conflict — please retry",
      );
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const reservation = await tx.reservation.create({
      data: {
        userId,
        productId: input.productId,
        quantity: input.quantity,
        expiresAt,
      },
    });

    await tx.inventoryLog.create({
      data: {
        productId: input.productId,
        change: -input.quantity,
        reason: `Reserved ${input.quantity} unit(s) — reservation ${reservation.id}`,
      },
    });

    logger.info(
      `Reserved ${input.quantity} unit(s) of product ${input.productId} for user ${userId} — reservation ${reservation.id}`,
    );

    return reservation;
  });
};

export const completeCheckout = async (
  reservationId: string,
  userId: string,
) => {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      include: { product: true },
    });

    if (!reservation) throw new ApiError(404, "Reservation not found");
    if (reservation.userId !== userId) throw new ApiError(403, "Forbidden");
    if (reservation.status !== "PENDING") {
      throw new ApiError(409, `Reservation is ${reservation.status}`);
    }
    if (reservation.expiresAt < new Date()) {
      throw new ApiError(409, "Reservation has expired");
    }

    const totalAmount = (
      Number(reservation.product.price) * reservation.quantity
    ).toString();

    const order = await tx.order.create({
      data: {
        userId,
        productId: reservation.productId,
        reservationId: reservation.id,
        totalAmount,
      },
    });

    const completed = await tx.reservation.update({
      where: { id: reservationId },
      data: { status: "COMPLETED" },
    });

    logger.info(
      `Checkout completed — reservation ${reservationId}, order ${order.id}`,
    );

    return { order, reservation: completed };
  });
};
