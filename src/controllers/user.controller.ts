import { Request, Response, NextFunction } from "express";
import * as userService from "../services/user.service";
import createResponse from "../utils/response";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

const JWT_SECRET = env.JWT_SECRET;

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await userService.createUser(req.body);
    return res.status(201).json(
      createResponse({
        success: true,
        status: 201,
        message: "User registered successfully",
        data: user,
      }),
    );
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await userService.findUserByEmail(req.body.email);
    if (!user) throw new ApiError(401, "Invalid credentials");

    const valid = await bcrypt.compare(req.body.password, user.password);
    if (!valid) throw new ApiError(401, "Invalid credentials");

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as unknown as number,
    });

    return res.status(200).json(
      createResponse({
        success: true,
        status: 200,
        message: "Login successful",
        data: { token },
      }),
    );
  } catch (error) {
    next(error);
  }
};
