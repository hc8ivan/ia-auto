import { randomUUID } from "node:crypto";
import { config } from "../config/env.js";
import { isValidEmail } from "../lib/emailValidation.js";
import { AppError } from "../lib/AppError.js";
import {
  sumTablesUsedDuring,
  freeTables as freeTablesTotal,
} from "../lib/reservationAvailabilityMath.js";
import { getDb } from "../db/database.js";
import * as auditRepository from "../repositories/auditRepository.js";
import * as reservationRepository from "../repositories/reservationRepository.js";
import * as sessionRepository from "../repositories/sessionRepository.js";
import * as scheduleService from "./scheduleService.js";
import * as mailService from "./mailService.js";

function tablesForParty(partySize) {
  return Math.max(1, Math.ceil(partySize / config.seatsPerTable));
}

function sumTablesDuring(dateYmd, startMin, endMin) {
  const rows = reservationRepository.listConfirmedForDate(dateYmd);
  return sumTablesUsedDuring(
    rows,
    startMin,
    endMin,
    scheduleService.hhmmToMinutes,
  );
}

function freeTablesDuring(dateYmd, startMin, endMin) {
  return freeTablesTotal(
    config.restaurantTableCount,
    sumTablesDuring(dateYmd, startMin, endMin),
  );
}

/**
 * @param {number} startMin
 * @param {ReturnType<typeof scheduleService.getResolvedIntervalsForYmd>} day
 */
function pickDurationForSlot(startMin, day) {
  if (day.status !== "open") return null;
  if (day.lunch) {
    const endL = startMin + config.reservationLunchDurationMin;
    if (startMin >= day.lunch.startMin && endL <= day.lunch.endMin) {
      return {
        duration: config.reservationLunchDurationMin,
        meal: /** @type {const} */ ("lunch"),
      };
    }
  }
  if (day.dinner) {
    const endD = startMin + config.reservationDinnerDurationMin;
    if (startMin >= day.dinner.startMin && endD <= day.dinner.endMin) {
      return {
        duration: config.reservationDinnerDurationMin,
        meal: /** @type {const} */ ("dinner"),
      };
    }
  }
  return null;
}

/**
 * @param {{ startMin: number, endMin: number } | null} interval
 * @param {number} duration
 * @param {number} step
 */
function generateSlotStarts(interval, duration, step) {
  if (!interval) return [];
  const out = [];
  for (let t = interval.startMin; t + duration <= interval.endMin; t += step) {
    out.push(t);
  }
  return out;
}

function minutesToHHmm(m) {
  const h = Math.floor(m / 60);
  const mi = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

export function getAvailabilitySummaryForTool(dateYmd) {
  const day = scheduleService.getResolvedIntervalsForYmd(dateYmd);
  if (day.status === "closed") {
    return {
      ok: true,
      date: dateYmd,
      closed: true,
      message: "El restaurante está cerrado ese día según el calendario.",
      totalTables: config.restaurantTableCount,
    };
  }

  const step = config.availabilitySlotStepMin;
  /** @type {{ lunch: object[], dinner: object[] }} */
  const slots = { lunch: [], dinner: [] };

  if (day.lunch) {
    const dur = config.reservationLunchDurationMin;
    for (const start of generateSlotStarts(day.lunch, dur, step)) {
      const end = start + dur;
      const used = sumTablesDuring(dateYmd, start, end);
      const free = config.restaurantTableCount - used;
      slots.lunch.push({
        time: minutesToHHmm(start),
        endsAt: minutesToHHmm(end),
        freeTables: Math.max(0, free),
        totalTables: config.restaurantTableCount,
      });
    }
  }

  if (day.dinner) {
    const dur = config.reservationDinnerDurationMin;
    for (const start of generateSlotStarts(day.dinner, dur, step)) {
      const end = start + dur;
      const used = sumTablesDuring(dateYmd, start, end);
      const free = config.restaurantTableCount - used;
      slots.dinner.push({
        time: minutesToHHmm(start),
        endsAt: minutesToHHmm(end),
        freeTables: Math.max(0, free),
        totalTables: config.restaurantTableCount,
      });
    }
  }

  return {
    ok: true,
    date: dateYmd,
    closed: false,
    totalTables: config.restaurantTableCount,
    seatsPerTable: config.seatsPerTable,
    lunchDurationMinutes: config.reservationLunchDurationMin,
    dinnerDurationMinutes: config.reservationDinnerDurationMin,
    slots,
  };
}

/**
 * @param {Record<string, unknown>} input
 * @param {string | undefined} sessionId
 */
export async function createReservationFromTool(input, sessionId) {
  const date = input.date;
  const time = input.time;
  const partySizeRaw = input.party_size;
  const customer_name = input.customer_name;
  const customer_phone = input.customer_phone;
  const customer_email = input.customer_email;

  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "Fecha inválida; usa YYYY-MM-DD." };
  }

  const startMin =
    typeof time === "string" ? scheduleService.hhmmToMinutes(time) : null;
  if (startMin === null) {
    return { ok: false, error: "Hora inválida; usa HH:mm (24h)." };
  }

  const party = Number(partySizeRaw);
  if (!Number.isInteger(party) || party < 1) {
    return { ok: false, error: "Número de comensales inválido." };
  }

  const name =
    typeof customer_name === "string" ? customer_name.trim() : "";
  const phone =
    typeof customer_phone === "string" ? customer_phone.trim() : "";
  const email =
    typeof customer_email === "string" ? customer_email.trim() : "";

  if (name.length < 2) {
    return { ok: false, error: "Nombre de contacto demasiado corto." };
  }
  if (phone.length < 6) {
    return { ok: false, error: "Teléfono demasiado corto." };
  }
  if (!isValidEmail(email)) {
    return {
      ok: false,
      error: "Correo electrónico no válido. Pida un email real antes de registrar.",
    };
  }

  const day = scheduleService.getResolvedIntervalsForYmd(date);
  if (day.status === "closed") {
    return { ok: false, error: "Ese día el restaurante está cerrado." };
  }

  const picked = pickDurationForSlot(startMin, day);
  if (!picked) {
    return {
      ok: false,
      error:
        "La hora no encaja en comida o cena con la duración reservada; elige otra hora o usa check_availability.",
    };
  }

  const tablesUsed = tablesForParty(party);
  if (tablesUsed > config.restaurantTableCount) {
    return {
      ok: false,
      error: `Este grupo requiere más de ${config.restaurantTableCount} mesas; contacta con el restaurante.`,
    };
  }

  const endMin = startMin + picked.duration;
  const timeStr = minutesToHHmm(startMin);

  /** @type {{ kind: 'duplicate', id: string, duration_minutes: number, tables_used: number } | { kind: 'new', id: string }} */
  let txOutcome;
  try {
    txOutcome = getDb()
      .transaction(() => {
        if (sessionId) {
          const dup =
            reservationRepository.findRecentDuplicateForSession(
              sessionId,
              date,
              timeStr,
              party,
              config.reservationIdempotencyWindowSec,
            );
          if (dup) {
            return {
              kind: /** @type {const} */ ("duplicate"),
              id: dup.id,
              duration_minutes: dup.duration_minutes,
              tables_used: dup.tables_used,
            };
          }
        }

        const rows = reservationRepository.listConfirmedForDate(date);
        const used = sumTablesUsedDuring(
          rows,
          startMin,
          endMin,
          scheduleService.hhmmToMinutes,
        );
        const free = config.restaurantTableCount - used;
        if (free < tablesUsed) {
          throw new AppError(
            409,
            `No hay suficientes mesas libres (necesarias: ${tablesUsed}, libres: ${free}). Usa check_availability y ofrece otra franja.`,
          );
        }

        const id = randomUUID();
        reservationRepository.insertReservation({
          id,
          reservation_date: date,
          start_time: timeStr,
          duration_minutes: picked.duration,
          party_size: party,
          tables_used: tablesUsed,
          customer_name: name,
          customer_phone: phone,
          customer_email: email,
          session_id: sessionId ?? null,
          notes: null,
        });
        return { kind: /** @type {const} */ ("new"), id };
      })
      .immediate();
  } catch (e) {
    if (e instanceof AppError) {
      return { ok: false, error: e.message };
    }
    throw e;
  }

  const isDuplicate = txOutcome.kind === "duplicate";
  const id = txOutcome.id;

  if (!isDuplicate && sessionId) {
    sessionRepository.updateSessionContact(sessionId, {
      name,
      phone,
      email,
    });
  }

  let confirmationEmailSent = false;
  let confirmationEmailDetail = "sent";

  if (!isDuplicate && mailService.isMailConfigured()) {
    const mailResult = await mailService.sendReservationConfirmationEmail({
      to: email,
      customerName: name,
      reservation: {
        id,
        date,
        time: timeStr,
        partySize: party,
        meal: picked.meal,
      },
    });
    confirmationEmailSent = Boolean(mailResult.sent);
    if (!mailResult.sent) {
      confirmationEmailDetail = mailResult.error ?? "send_failed";
    }
  } else if (!isDuplicate) {
    confirmationEmailDetail = "smtp_not_configured";
    console.warn(
      "[mail] SMTP no configurado (SMTP_HOST / MAIL_FROM); reserva guardada sin email.",
    );
  } else {
    confirmationEmailDetail = "skipped_duplicate_tool_call";
  }

  auditRepository.insertBusinessEvent({
    sessionId: sessionId ?? null,
    eventType: isDuplicate
      ? "reservation.idempotent_hit"
      : "reservation.created",
    entityType: "reservation",
    entityId: id,
    payload: {
      reservation_date: date,
      start_time: timeStr,
      party_size: party,
      tables_used: isDuplicate ? txOutcome.tables_used : tablesUsed,
      meal: picked.meal,
      duration_minutes: isDuplicate
        ? txOutcome.duration_minutes
        : picked.duration,
      confirmation_email_sent: confirmationEmailSent,
      confirmation_email_detail: confirmationEmailDetail,
    },
  });

  return {
    ok: true,
    reservationId: id,
    date,
    time: timeStr,
    party_size: party,
    tablesUsed: isDuplicate ? txOutcome.tables_used : tablesUsed,
    meal: picked.meal,
    durationMinutes: isDuplicate
      ? txOutcome.duration_minutes
      : picked.duration,
    confirmationEmailSent,
    confirmationEmailDetail:
      confirmationEmailSent === true ? undefined : confirmationEmailDetail,
    duplicateOfPreviousToolCall: isDuplicate || undefined,
  };
}

/**
 * @param {string} name
 * @param {Record<string, unknown>} args
 * @param {string | undefined} sessionId
 */
export async function executeAssistantTool(name, args, sessionId) {
  if (name === "check_availability") {
    const d = args?.date;
    if (typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      return { ok: false, error: "Parámetro date obligatorio (YYYY-MM-DD)." };
    }
    return getAvailabilitySummaryForTool(d);
  }
  if (name === "create_reservation") {
    return createReservationFromTool(args ?? {}, sessionId);
  }
  return { ok: false, error: `Herramienta desconocida: ${name}` };
}
