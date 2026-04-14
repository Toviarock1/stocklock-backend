import rateLimit from "express-rate-limit";
import createResponse from "../utils/response";

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: createResponse({
    success: false,
    status: 429,
    message: "Too many requests, please try again later",
  }),
});

export const reserveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: createResponse({
    success: false,
    status: 429,
    message: "Too many reserve attempts, please slow down",
  }),
});
