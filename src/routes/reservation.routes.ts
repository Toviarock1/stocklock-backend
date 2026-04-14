import { Router } from "express";
import { reserve, checkout } from "../controllers/reservation.controller";
import { validate } from "../middleware/validate.middleware";
import { reserveSchema, checkoutSchema } from "../schemas/reservation.schema";
import { authenticateJwt } from "../middleware/auth.middleware";
import { reserveLimiter } from "../middleware/rateLimit.middleware";

const router = Router();

router.use(authenticateJwt);

router.post("/reserve", reserveLimiter, validate(reserveSchema), reserve);
router.post("/:id/checkout", validate(checkoutSchema), checkout);

export default router;
