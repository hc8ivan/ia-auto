import { DateTime } from "luxon";
import { config } from "../config/env.js";
import * as scheduleRepository from "../repositories/scheduleRepository.js";

/**
 * @typedef {{ date: string, weekdayLabel: string, status: 'open'|'closed', lunch: string | null, dinner: string | null, note: string | null }} DayPublic
 */

function mealParts(lOpen, lClose, dOpen, dClose) {
  /** @type {{ lunch: string | null, dinner: string | null }} */
  const out = { lunch: null, dinner: null };
  if (lOpen && lClose) out.lunch = `${lOpen}–${lClose}`;
  if (dOpen && dClose) out.dinner = `${dOpen}–${dClose}`;
  return out;
}

/**
 * @param {import('../repositories/scheduleRepository.js').ExceptionRow | undefined} ex
 * @param {import('../repositories/scheduleRepository.js').OpeningRow | undefined} weekly
 */
function resolveDay(ex, weekly) {
  if (ex) {
    if (ex.is_closed === 1) {
      return {
        status: /** @type {const} */ ("closed"),
        lunch: null,
        dinner: null,
        note: ex.note,
      };
    }
    const exMeals = mealParts(
      ex.lunch_open,
      ex.lunch_close,
      ex.dinner_open,
      ex.dinner_close,
    );
    const hasOverride =
      exMeals.lunch !== null || exMeals.dinner !== null;
    if (hasOverride) {
      return {
        status: /** @type {const} */ ("open"),
        lunch: exMeals.lunch,
        dinner: exMeals.dinner,
        note: ex.note,
      };
    }
  }

  if (!weekly || weekly.is_closed === 1) {
    return {
      status: /** @type {const} */ ("closed"),
      lunch: null,
      dinner: null,
      note: null,
    };
  }

  const w = mealParts(
    weekly.lunch_open,
    weekly.lunch_close,
    weekly.dinner_open,
    weekly.dinner_close,
  );
  return {
    status: /** @type {const} */ ("open"),
    lunch: w.lunch,
    dinner: w.dinner,
    note: null,
  };
}

function formatDayLine(ymd, weekdayLabel, resolved) {
  if (resolved.status === "closed") {
    const note = resolved.note ? ` ${resolved.note}` : "";
    return `- ${ymd} · ${weekdayLabel}: CERRADO.${note}`;
  }
  const chunks = [];
  if (resolved.lunch) chunks.push(`Comida ${resolved.lunch}`);
  if (resolved.dinner) chunks.push(`Cena ${resolved.dinner}`);
  const body = chunks.join(" · ");
  const note = resolved.note ? ` (${resolved.note})` : "";
  return `- ${ymd} · ${weekdayLabel}: ${body}${note}`;
}

/**
 * Texto que se inyecta en el system prompt del modelo (datos oficiales).
 */
export function buildSchedulePromptBlock() {
  const tz = config.restaurantTimezone;
  const nDays = Math.min(31, Math.max(1, config.scheduleContextDays));
  const weekly = scheduleRepository.getWeeklyHoursMap();

  const start = DateTime.now().setZone(tz).startOf("day");
  const end = start.plus({ days: nDays - 1 });
  const startY = start.toFormat("yyyy-MM-dd");
  const endY = end.toFormat("yyyy-MM-dd");
  const exceptions = scheduleRepository.getExceptionsBetween(startY, endY);
  const exMap = new Map(exceptions.map((e) => [e.exception_date, e]));

  const lines = [];
  lines.push("--- CALENDARIO Y HORARIOS (FUENTE: BASE DE DATOS; OBLIGATORIO CUMPLIR) ---");
  lines.push(`Zona horaria: ${tz}.`);
  lines.push(
    `Hoy: ${start.setLocale("es").toFormat("cccc d 'de' MMMM yyyy")} (${startY}).`,
  );
  lines.push("");
  lines.push(`Previsión próximos ${nDays} días:`);
  for (let i = 0; i < nDays; i++) {
    const dt = start.plus({ days: i });
    const ymd = dt.toFormat("yyyy-MM-dd");
    const weekdayLabel = dt.setLocale("es").toFormat("cccc");
    const weekdayJs = dt.toJSDate().getDay();
    const resolved = resolveDay(exMap.get(ymd), weekly.get(weekdayJs));
    lines.push(formatDayLine(ymd, weekdayLabel, resolved));
  }
  lines.push("");
  lines.push(
    "Criterios internos (aplicar al orientar al cliente; no copiar este bloque textualmente en la respuesta):",
  );
  lines.push("- No hay reservas en días CERRADOS ni fuera de las franjas de comida/cena de cada línea.");
  lines.push("- La comida termina a la hora de cierre de su franja; ajústelo al explicar últimas mesas.");
  lines.push("- Si choca excepción y horario habitual, manda la línea de ese día en esta lista.");
  lines.push(
    `- Sala: ${config.restaurantTableCount} mesas; grupos grandes según disponibilidad real (herramienta check_availability).`,
  );
  lines.push("--- FIN CALENDARIO ---");
  return lines.join("\n");
}

/** @param {string} s */
export function hhmmToMinutes(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s).trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (!Number.isInteger(h) || !Number.isInteger(mi) || h > 23 || mi > 59) {
    return null;
  }
  return h * 60 + mi;
}

/**
 * @param {string | null | undefined} range ej. "13:00–16:00"
 * @returns {{ startMin: number, endMin: number } | null}
 */
function intervalFromRangeString(range) {
  if (!range) return null;
  const normalized = String(range).replace(/\u2013/g, "-").replace(/–/g, "-");
  const parts = normalized.split("-").map((x) => x.trim());
  if (parts.length < 2) return null;
  const startMin = hhmmToMinutes(parts[0]);
  const endMin = hhmmToMinutes(parts[1]);
  if (startMin === null || endMin === null) return null;
  return { startMin, endMin };
}

/**
 * Franjas comida/cena resueltas para una fecha (Madrid).
 * @param {string} ymd
 * @returns {{ status: 'closed' } | { status: 'open', lunch: { startMin: number, endMin: number } | null, dinner: { startMin: number, endMin: number } | null }}
 */
export function getResolvedIntervalsForYmd(ymd) {
  const tz = config.restaurantTimezone;
  const dt = DateTime.fromISO(ymd, { zone: tz });
  if (!dt.isValid) {
    return { status: /** @type {const} */ ("closed") };
  }

  const weekly = scheduleRepository.getWeeklyHoursMap();
  const exList = scheduleRepository.getExceptionsBetween(ymd, ymd);
  const ex = exList[0];
  const weekdayJs = dt.toJSDate().getDay();
  const resolved = resolveDay(ex, weekly.get(weekdayJs));

  if (resolved.status === "closed") {
    return { status: /** @type {const} */ ("closed") };
  }

  return {
    status: /** @type {const} */ ("open"),
    lunch: intervalFromRangeString(resolved.lunch),
    dinner: intervalFromRangeString(resolved.dinner),
  };
}

/**
 * @param {number | undefined} requestedDays
 */
export function getPublicSchedule(requestedDays) {
  const tz = config.restaurantTimezone;
  const nDays = Math.min(
    31,
    Math.max(
      1,
      requestedDays ?? config.scheduleContextDays,
    ),
  );
  const weekly = scheduleRepository.getWeeklyHoursMap();
  const start = DateTime.now().setZone(tz).startOf("day");
  const end = start.plus({ days: nDays - 1 });
  const exceptions = scheduleRepository.getExceptionsBetween(
    start.toFormat("yyyy-MM-dd"),
    end.toFormat("yyyy-MM-dd"),
  );
  const exMap = new Map(exceptions.map((e) => [e.exception_date, e]));

  /** @type {DayPublic[]} */
  const days = [];
  for (let i = 0; i < nDays; i++) {
    const dt = start.plus({ days: i });
    const ymd = dt.toFormat("yyyy-MM-dd");
    const weekdayJs = dt.toJSDate().getDay();
    const resolved = resolveDay(exMap.get(ymd), weekly.get(weekdayJs));
    days.push({
      date: ymd,
      weekdayLabel: dt.setLocale("es").toFormat("cccc"),
      status: resolved.status,
      lunch: resolved.lunch,
      dinner: resolved.dinner,
      note: resolved.note,
    });
  }

  return {
    timezone: tz,
    generatedAt: DateTime.now().setZone(tz).toISO(),
    days,
    capacity: {
      tables: config.restaurantTableCount,
      seatsPerTable: config.seatsPerTable,
    },
    site: {
      name: config.restaurantDisplayName,
      publicBaseUrl: config.publicBaseUrl ? config.publicBaseUrl : null,
    },
  };
}
