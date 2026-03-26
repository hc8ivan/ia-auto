import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import express from "express";
import compression from "compression";
import helmet from "helmet";
import cors from "cors";
import { config } from "./config/env.js";
import { databaseForeignKeysOk, databaseHealthCheck } from "./db/database.js";
import * as mailService from "./services/mailService.js";
import scheduleRoutes from "./routes/scheduleRoutes.js";
import reservationRoutes from "./routes/reservationRoutes.js";
import mailRoutes from "./routes/mailRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestId } from "./middleware/requestId.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const require = createRequire(import.meta.url);
const { version: appVersion } = require("../package.json");

export function createApp() {
  const app = express();

  if (config.trustProxy) {
    app.set("trust proxy", 1);
  }

  app.use(requestId);

  app.disable("x-powered-by");

  app.use(
    compression({
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers["x-no-compression"]) return false;
        return compression.filter(req, res);
      },
    }),
  );

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      ...(config.isDev
        ? { contentSecurityPolicy: false }
        : {
            contentSecurityPolicy: {
              directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "https://fonts.googleapis.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com"],
                imgSrc: ["'self'", "data:"],
                connectSrc: ["'self'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
                frameAncestors: ["'none'"],
              },
            },
          }),
    }),
  );

  app.use(
    cors({
      origin: config.corsOrigin,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-Admin-Key", "Authorization"],
    }),
  );

  app.use(express.json({ limit: "32kb" }));

  const reservasHtml = path.join(publicDir, "reservas.html");
  app.get(["/reservas", "/reservas.html"], (_req, res) => {
    res.sendFile(reservasHtml);
  });

  app.get("/health", (_req, res) => {
    const dbOk = databaseHealthCheck();
    const fkOk = dbOk ? databaseForeignKeysOk() : false;
    const mail = mailService.getMailConfigStatus();
    const ok = dbOk && fkOk;
    const status = ok ? 200 : 503;
    res.status(status).json({
      status: ok ? "ok" : "degraded",
      version: appVersion,
      database: dbOk,
      foreignKeys: fkOk,
      mailReady: mail.ready,
    });
  });

  app.use(express.static(publicDir, { index: "index.html", extensions: ["html"] }));

  app.use("/api", scheduleRoutes);
  app.use("/api", reservationRoutes);
  app.use("/api", mailRoutes);
  app.use("/api", chatRoutes);
  app.use("/api", adminRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
