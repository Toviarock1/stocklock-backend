import { Router } from "express";
import { register, login } from "../controllers/user.controller";
import { validate } from "../middleware/validate.middleware";
import { createUserSchema, loginUserSchema } from "../schemas/user.schema";

const router = Router();

router.post("/register", validate(createUserSchema), register);
router.post("/login", validate(loginUserSchema), login);

export default router;
