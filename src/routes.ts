import { Router } from "express";
import userRoutes from "./routes/user.routes";
import productRoutes from "./routes/product.routes";
import reservationRoutes from "./routes/reservation.routes";
import metricsRoutes from "./routes/metrics.routes";
import { generalLimiter } from "./middleware/rateLimit.middleware";

const rootRouter = Router();

rootRouter.use(generalLimiter);

rootRouter.use("/users", userRoutes);
rootRouter.use("/products", productRoutes);
rootRouter.use("/reservations", reservationRoutes);
rootRouter.use("/metrics", metricsRoutes);

export default rootRouter;
