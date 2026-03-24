import { AppError } from "../lib/AppError.js";

export function notFound(_req, _res, next) {
  next(new AppError(404, "Recurso no encontrado."));
}
