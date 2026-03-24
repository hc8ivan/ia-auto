import { AppError } from "../lib/AppError.js";
import { config } from "../config/env.js";

/**
 * Protege rutas de staff. Cliente envía la misma clave que ADMIN_API_KEY en el servidor.
 * @type {import('express').RequestHandler}
 */
export function requireAdminKey(req, _res, next) {
  if (!config.adminApiKey) {
    throw new AppError(
      503,
      "Panel de reservas desactivado: defina ADMIN_API_KEY en el servidor (.env o Render).",
    );
  }
  const raw =
    req.headers["x-admin-key"] ??
    (typeof req.headers.authorization === "string"
      ? req.headers.authorization.replace(/^Bearer\s+/i, "").trim()
      : "");
  const key = typeof raw === "string" ? raw.trim() : "";
  if (!key || key !== config.adminApiKey) {
    throw new AppError(401, "Clave de administración incorrecta o ausente.");
  }
  next();
}
