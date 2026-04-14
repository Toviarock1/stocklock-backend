import { Request, Response, NextFunction } from "express";
import * as reservationService from "../services/reservation.service";
import createResponse from "../utils/response";
import { ReserveInput } from "../schemas/reservation.schema";

export const reserve = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const input = req.body as ReserveInput;
    const reservation = await reservationService.reserveProduct(
      req.userId,
      input,
    );

    return res.status(201).json(
      createResponse({
        success: true,
        status: 201,
        message: "Reservation created",
        data: reservation,
      }),
    );
  } catch (error) {
    next(error);
  }
};

export const checkout = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params as { id: string };
    const result = await reservationService.completeCheckout(id, req.userId);

    return res.status(200).json(
      createResponse({
        success: true,
        status: 200,
        message: "Checkout completed",
        data: result,
      }),
    );
  } catch (error) {
    next(error);
  }
};
