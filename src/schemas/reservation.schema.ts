import { z } from "zod";

export const reserveSchema = z.object({
  body: z.object({
    productId: z.string().uuid("Invalid product ID"),
    quantity: z.number().int().min(1).max(10),
  }),
});

export const checkoutSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid reservation ID"),
  }),
});

export type ReserveInput = z.infer<typeof reserveSchema>["body"];
export type CheckoutParams = z.infer<typeof checkoutSchema>["params"];
