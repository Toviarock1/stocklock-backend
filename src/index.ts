import app from "./server";
import http from "http";
import setupMiddleware from "./startup/middleware";
import setupRoutes from "./startup/routes";
import { startExpiryJob } from "./services/cron.service";
import { env } from "./config/env";
import { logger } from "./config/logger";

setupMiddleware(app);
setupRoutes(app);
startExpiryJob();
logger.info("Reservation expiry cron job started");
const port = env.PORT;
const server = http.createServer(app);

server.listen(port, () => {
  logger.info(`listening on localhost: ${port}, NODE_ENV: ${env.NODE_ENV}`);
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    logger.info("Process terminated");
  });
});
