import { createRequire } from "node:module";
import { initDatabase, closeDatabase } from "./db/database.js";
import { seedOpeningHoursIfEmpty } from "./repositories/scheduleRepository.js";
import { createApp } from "./app.js";
import { config } from "./config/env.js";
import { logger } from "./lib/logger.js";

const require = createRequire(import.meta.url);
const { version: appVersion } = require("../package.json");

initDatabase();
seedOpeningHoursIfEmpty();

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info("server_listening", {
    port: config.port,
    version: appVersion,
    node: process.version,
  });
});

const SHUTDOWN_MS = 10_000;

function gracefulShutdown(signal) {
  logger.info("shutdown_signal", { signal });
  server.close((closeErr) => {
    if (closeErr) {
      logger.error("shutdown_http_close_failed", {
        message: closeErr.message,
      });
    }
    closeDatabase();
    logger.info("shutdown_complete", {});
    process.exit(closeErr ? 1 : 0);
  });

  setTimeout(() => {
    logger.error("shutdown_forced_timeout", { ms: SHUTDOWN_MS });
    closeDatabase();
    process.exit(1);
  }, SHUTDOWN_MS).unref();
}

process.once("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.once("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error("unhandled_rejection", {
    reason:
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : String(reason),
  });
});

process.on("uncaughtException", (err) => {
  logger.error("uncaught_exception", {
    message: err.message,
    name: err.name,
  });
  closeDatabase();
  process.exit(1);
});
