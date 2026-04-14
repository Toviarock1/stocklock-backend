// src/middleware/error.middleware.ts
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "./../generated/prisma/client";
import createResponse from "../utils/response"; // Your helper
import { logger } from "../config/logger";

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let status = err instanceof Error && "status" in err ? (err as any).status : 500;
  let message = err instanceof Error ? err.message : "Internal Server Error";
  let data = null;

  // 1. Handle Zod Validation Errors
  if (err instanceof ZodError) {
    status = 400;
    message = "Validation Failed";
    data = err.issues.map((e) => ({ path: e.path.join("."), message: e.message }));
  }

  // 2. Handle Prisma Concurrency/Database Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      // Unique constraint (e.g. duplicate email)
      status = 409;
      message = "Resource already exists";
    }
    if (err.code === "P2025") {
      // Record not found
      status = 404;
      message = "Record not found";
    }
  }

  // 3. Log the error for observability
  logger.error(
    `${req.method} ${req.path} - Status: ${status} - Error: ${message}`,
  );

  // 4. Send standardized response
  const apiResponse = createResponse({
    success: false,
    status,
    message,
    data,
  });

  return res.status(status).json(apiResponse);
};
