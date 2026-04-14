import prisma from "../config/db";
import { Prisma } from "../generated/prisma/client";
import { ApiError } from "../utils/ApiError";
import { logger } from "../config/logger";
import { GetProductsQuery } from "../schemas/product.schema";

export interface ProductListResult {
  products: Prisma.ProductGetPayload<object>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const getProducts = async (
  query: GetProductsQuery,
): Promise<ProductListResult> => {
  const { page, limit, name, inStock, sortBy, order } = query;

  const where: Prisma.ProductWhereInput = {};

  if (name) {
    where.name = { contains: name, mode: "insensitive" };
  }
  if (inStock === "true") {
    where.availableStock = { gt: 0 };
  } else if (inStock === "false") {
    where.availableStock = { equals: 0 };
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput = {
    [sortBy]: order,
  };

  const skip = (page - 1) * limit;

  const [products, total] = await Promise.all([
    prisma.product.findMany({ where, orderBy, skip, take: limit }),
    prisma.product.count({ where }),
  ]);

  logger.info(`getProducts: returned ${products.length} of ${total} products`);

  return {
    products,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

export const getProductById = async (id: string) => {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new ApiError(404, "Product not found");
  return product;
};
