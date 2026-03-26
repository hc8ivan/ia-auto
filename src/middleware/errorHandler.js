import { AppError } from "../lib/AppError.js";
import { config } from "../config/env.js";
import { logger } from "../lib/logger.js";

/**
 * Último middleware: respuestas JSON coherentes y sin filtrar detalles internos en producción.
 * @type {import('express').ErrorRequestHandler}
 */
export function errorHandler(err, req, res, _next) {
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

  const requestId =
    "requestId" in req && typeof req.requestId === "string"
      ? req.requestId
      : undefined;

  if (status >= 500) {
    logger.error("request_failed", {
      requestId,
      status,
      name: err instanceof Error ? err.name : "Error",
      message: err instanceof Error ? err.message : String(err),
    });
    if (config.isDev && err instanceof Error && err.stack) {
      console.error(err.stack);
    }
  }

  /** @type {Record<string, unknown>} */
  const body = { error: message };
  if (requestId) {
    body.requestId = requestId;
  }
  res.status(status).json(body);
}
