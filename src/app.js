import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { config } from "./config/env.js";
import { databaseForeignKeysOk, databaseHealthCheck } from "./db/database.js";
import scheduleRoutes from "./routes/scheduleRoutes.js";
import reservationRoutes from "./routes/reservationRoutes.js";
import mailRoutes from "./routes/mailRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestId } from "./middleware/requestId.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

export function createApp() {
  const app = express();

  if (config.trustProxy) {
    app.set("trust proxy", 1);
  }

  app.use(requestId);

  app.disable("x-powered-by");

  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );

  app.use(
    cors({
      origin: config.corsOrigin,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type"],
    }),
  );

  app.use(express.json({ limit: "32kb" }));

  app.get("/health", (_req, res) => {
    const dbOk = databaseHealthCheck();
    const fkOk = dbOk ? databaseForeignKeysOk() : false;
    const ok = dbOk && fkOk;
    const status = ok ? 200 : 503;
    res.status(status).json({
      status: ok ? "ok" : "degraded",
      database: dbOk,
      foreignKeys: fkOk,
    });
  });

  app.use(express.static(publicDir, { index: "index.html", extensions: ["html"] }));

  app.use("/api", scheduleRoutes);
  app.use("/api", reservationRoutes);
  app.use("/api", mailRoutes);
  app.use("/api", chatRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
