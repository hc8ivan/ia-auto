import { randomUUID } from "node:crypto";

const MAX_LEN = 128;

/**
 * Correlación de logs y cabecera de respuesta (útil tras proxy / en producción).
 * @type {import('express').RequestHandler}
 */
export function requestId(req, res, next) {
  const fromClient = req.headers["x-request-id"];
  const id =
    typeof fromClient === "string" && fromClient.length > 0
      ? fromClient.slice(0, MAX_LEN)
      : randomUUID();
  req.requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
}
