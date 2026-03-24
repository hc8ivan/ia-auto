import { AppError } from "../lib/AppError.js";
import * as reservationRepository from "../repositories/reservationRepository.js";
import * as mailService from "../services/mailService.js";

const MAX_RANGE_DAYS = 120;

/** @param {unknown} s */
function isYmd(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** @param {string} a @param {string} b */
function daysBetweenInclusive(a, b) {
  const d0 = new Date(`${a}T12:00:00Z`);
  const d1 = new Date(`${b}T12:00:00Z`);
  return Math.floor((d1 - d0) / 86400000) + 1;
}

export function listReservationsInRange(req, res) {
  const from = req.query.from;
  const to = req.query.to;
  if (!isYmd(from) || !isYmd(to)) {
    throw new AppError(400, "Query obligatoria: from=YYYY-MM-DD&to=YYYY-MM-DD.");
  }
  if (from > to) {
    throw new AppError(400, "from no puede ser posterior a to.");
  }
  const span = daysBetweenInclusive(from, to);
  if (span > MAX_RANGE_DAYS) {
    throw new AppError(
      400,
      `Rango máximo ${MAX_RANGE_DAYS} días. Acorte from/to.`,
    );
  }
  const reservations = reservationRepository.listConfirmedBetween(from, to);
  res.json({
    from,
    to,
    count: reservations.length,
    reservations,
  });
}

export async function postMailTest(req, res) {
  const to = req.body?.to ?? req.body?.email;
  if (typeof to !== "string" || !to.trim()) {
    throw new AppError(
      400,
      'Body JSON: { "to": "correo@ejemplo.com" }',
    );
  }
  if (!mailService.isMailConfigured()) {
    const s = mailService.getMailConfigStatus();
    throw new AppError(
      503,
      `SMTP no listo. Falta: ${s.missing.join(", ") || "revisar variables"}. Vea GET /api/mail/status.`,
    );
  }
  const result = await mailService.sendTransactionalMail({
    to: to.trim(),
    subject: "Prueba de correo — La Terraza (panel)",
    text: "Si lee esto, el envío SMTP desde el servidor funciona.",
    html: "<p>Si lee esto, el envío SMTP desde el servidor funciona.</p>",
  });
  if (!result.sent) {
    throw new AppError(502, result.error ?? "Fallo al enviar.");
  }
  res.json({ ok: true, messageId: result.messageId });
}
