import { z } from "zod";
import { AppError } from "../lib/AppError.js";

const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  sessionId: z
    .union([z.string().uuid(), z.null()])
    .optional()
    .transform((v) => (v == null ? undefined : v)),
});

export function validateChatBody(req, _res, next) {
  const parsed = chatRequestSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => i.message).join(" ");
    return next(
      new AppError(400, detail || "Petición inválida."),
    );
  }
  req.body = parsed.data;
  next();
}
