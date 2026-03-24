import { AppError } from "../lib/AppError.js";
import * as scheduleService from "../services/scheduleService.js";

/** @param {unknown} raw */
function firstQuery(raw) {
  if (raw === undefined) return undefined;
  return Array.isArray(raw) ? String(raw[0] ?? "") : String(raw);
}

export async function getSchedule(req, res) {
  const rawDays = firstQuery(req.query.days);
  let days;
  if (rawDays !== undefined && rawDays !== "") {
    const n = Number(rawDays);
    if (!Number.isInteger(n) || n < 1 || n > 31) {
      throw new AppError(400, "Parámetro days inválido (usa 1–31).");
    }
    days = n;
  }

  const payload = scheduleService.getPublicSchedule(days);
  res.json(payload);
}
