import { Router } from "express";
import { getProducts, getProductById } from "../controllers/product.controller";
import { validate } from "../middleware/validate.middleware";
import {
  getProductsSchema,
  getProductByIdSchema,
} from "../schemas/product.schema";

const router = Router();

router.get("/", validate(getProductsSchema), getProducts);
router.get("/:id", validate(getProductByIdSchema), getProductById);

export default router;
