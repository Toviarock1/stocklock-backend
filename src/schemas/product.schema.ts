import { z } from "zod";

export const getProductsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    name: z.string().optional(),
    inStock: z.enum(["true", "false"]).optional(),
    sortBy: z
      .enum(["name", "price", "availableStock", "createdAt"])
      .default("createdAt"),
    order: z.enum(["asc", "desc"]).default("desc"),
  }),
});

export const getProductByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid product ID"),
  }),
});

export type GetProductsQuery = z.infer<typeof getProductsSchema>["query"];
