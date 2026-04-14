import { Express, Request, Response, NextFunction } from "express";
import router from "./../routes";
import { errorHandler } from "../middleware/error.middleware";
import createResponse from "../utils/response";

export default function setupRoutes(app: Express) {
  app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
  });

  app.use("/api/v1", router);

  // 404 handler
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.status(404).json(createResponse({ success: false, status: 404, message: "Route not found" }));
  });

  // error handler — must be last
  app.use(errorHandler);
}
