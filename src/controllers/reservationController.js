import { AppError } from "../lib/AppError.js";
import * as reservationService from "../services/reservationService.js";

/** @param {unknown} raw */
function firstQuery(raw) {
  if (raw === undefined) return undefined;
  return Array.isArray(raw) ? String(raw[0] ?? "") : String(raw);
}

export async function getAvailability(req, res) {
  const date = firstQuery(req.query.date);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError(400, "Query obligatoria: date=YYYY-MM-DD.");
  }
  const payload = reservationService.getAvailabilitySummaryForTool(date);
  res.json(payload);
}
