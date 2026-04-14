import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

interface JwtPayloadWithUserId extends jwt.JwtPayload {
  userId: string;
}

export const authenticateJwt = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new ApiError(401, "Authentication required"));
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayloadWithUserId;

    if (!payload.userId) {
      return next(new ApiError(401, "Invalid token payload"));
    }

    req.userId = payload.userId;
    return next();
  } catch {
    return next(new ApiError(401, "Invalid or expired token"));
  }
};
