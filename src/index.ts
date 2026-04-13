import app from "./server";
import http from "http";
import setupMiddleware from "./startup/middleware";
import { env } from "./config/env";

setupMiddleware(app);
const port = env.PORT;
const server = http.createServer(app);

server.listen(port, () => {
  console.log(`listening on localhost: ${port}, NODE_ENV: ${env.NODE_ENV}`);
});
