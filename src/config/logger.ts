import winston from "winston";
import { env } from "./env";

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const level = () => {
  const envs = env.NODE_ENV || "development";
  return envs === "development" ? "debug" : "warn";
};

const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "white",
};

winston.addColors(colors);
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define where the logs should go (Transports)
const transports = [
  // Always log to the console
  new winston.transports.Console({ format: consoleFormat }),

  // In production, you'd also log errors to a file
  new winston.transports.File({
    filename: "logs/error.log",
    level: "error",
    format: fileFormat,
  }),

  // Log all activity to a combined file
  new winston.transports.File({ filename: "logs/all.log", format: fileFormat }),
];

// Create the logger instance
export const logger = winston.createLogger({
  level: level(),
  levels,
  transports,
});
