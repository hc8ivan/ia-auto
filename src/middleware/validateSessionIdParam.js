import { z } from "zod";
import { AppError } from "../lib/AppError.js";

export function validateSessionIdParam(req, _res, next) {
  const parsed = z.string().uuid().safeParse(req.params.sessionId);
  if (!parsed.success) {
    return next(new AppError(400, "Identificador de sesión inválido."));
  }
  req.params.sessionId = parsed.data;
  next();
}
