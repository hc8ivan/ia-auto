import { AppError } from "../lib/AppError.js";
import { config } from "../config/env.js";

/**
 * Último middleware: respuestas JSON coherentes y sin filtrar detalles internos en producción.
 * @type {import('express').ErrorRequestHandler}
 */
export function errorHandler(err, _req, res, _next) {
  if (res.headersSent) {
    return;
  }

  const status =
    err instanceof AppError
      ? err.statusCode
      : typeof err.status === "number"
        ? err.status
        : 500;

  const isClient = status >= 400 && status < 500;
  const message =
    err instanceof AppError
      ? err.message
      : isClient && typeof err.message === "string"
        ? err.message
        : config.isDev && err instanceof Error
          ? err.message
          : "Error interno del servidor.";

  if (status >= 500) {
    const rid = "requestId" in req && typeof req.requestId === "string" ? req.requestId : "";
    console.error(rid ? `[${rid}]` : "", err);
  }

  res.status(status).json({ error: message });
}
