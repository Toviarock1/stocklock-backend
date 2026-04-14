import prisma from "./../config/db";
import bcrypt from "bcrypt";
import { CreateUserInput } from "../schemas/user.schema";
import { ApiError } from "../utils/ApiError";

export const createUser = async (data: CreateUserInput) => {
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser)
    throw new ApiError(409, "User with this email already exists");

  const hashedPassword = await bcrypt.hash(data.password, 10);
  return await prisma.user.create({
    data: {
      ...data,
      password: hashedPassword,
    },
    select: { id: true, email: true, name: true },
  });
};

export const findUserByEmail = async (email: string) => {
  return await prisma.user.findUnique({
    where: { email },
  });
};
