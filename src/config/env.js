import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

/**
 * @param {string} name
 * @returns {string}
 */
function requireEnv(name) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Variable de entorno obligatoria ausente o vacía: ${name}`);
  }
  return value;
}

/**
 * @param {string} name
 * @param {number} fallback
 */
function intEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const port = Number.parseInt(process.env.PORT ?? "3000", 10);

const dbRelative = process.env.DATABASE_PATH ?? path.join("data", "chat.db");
export const config = {
  port: Number.isFinite(port) && port > 0 ? port : 3000,
  nodeEnv: process.env.NODE_ENV ?? "development",
  isDev: (process.env.NODE_ENV ?? "development") !== "production",
  openaiApiKey: requireEnv("OPENAI_API_KEY"),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  /** Ruta del fichero SQLite (relativa a `process.cwd()` o absoluta). */
  databasePath: path.isAbsolute(dbRelative)
    ? dbRelative
    : path.join(process.cwd(), dbRelative),
  /** Máximo de mensajes (user+assistant) enviados al modelo, incluido el actual. */
  chatHistoryMaxMessages: Math.max(1, intEnv("CHAT_HISTORY_MAX_MESSAGES", 24)),
  rateLimitWindowMs: intEnv("RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
  rateLimitMax: intEnv("RATE_LIMIT_MAX", 120),
  /** Tras proxy (nginx, etc.): número de hops o `true`. */
  trustProxy:
    process.env.TRUST_PROXY === "1" ||
    process.env.TRUST_PROXY === "true" ||
    (process.env.NODE_ENV === "production" &&
      process.env.TRUST_PROXY !== "false"),
  /** IANA tz del restaurante (fechas y “hoy” del calendario). */
  restaurantTimezone: process.env.RESTAURANT_TIMEZONE ?? "Europe/Madrid",
  /** Días que se envían al modelo en el bloque de calendario (1–31). */
  scheduleContextDays: Math.min(
    31,
    Math.max(1, intEnv("SCHEDULE_CONTEXT_DAYS", 14)),
  ),
  /** Mesas físicas del comedor. */
  restaurantTableCount: Math.max(1, intEnv("RESTAURANT_TABLE_COUNT", 15)),
  /** Comensales por mesa (se calcula ceil(party/seats) mesas usadas). */
  seatsPerTable: Math.max(1, intEnv("SEATS_PER_TABLE", 4)),
  reservationLunchDurationMin: Math.max(
    30,
    intEnv("RESERVATION_LUNCH_DURATION_MIN", 90),
  ),
  reservationDinnerDurationMin: Math.max(
    30,
    intEnv("RESERVATION_DINNER_DURATION_MIN", 120),
  ),
  availabilitySlotStepMin: Math.max(
    15,
    intEnv("AVAILABILITY_SLOT_STEP_MIN", 30),
  ),
  /** Máximo de vueltas tool → modelo (evita bucles). */
  assistantToolMaxRounds: Math.min(12, Math.max(1, intEnv("ASSISTANT_TOOL_MAX_ROUNDS", 6))),
  /** Nombre del local en el asunto/cuerpo del correo. */
  restaurantDisplayName: process.env.RESTAURANT_NAME ?? "La Terraza",
  /** SMTP opcional: si falta SMTP_HOST o MAIL_FROM, no se envía correo (la reserva igual se guarda). */
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: intEnv("SMTP_PORT", 587),
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  mailFrom: process.env.MAIL_FROM ?? "",
  /**
   * Si es false (por defecto), exige SMTP_USER y SMTP_PASS además de HOST y MAIL_FROM.
   * Pon true solo para relays internos sin autenticación.
   */
  smtpAllowNoAuth: process.env.SMTP_ALLOW_NO_AUTH === "true",
};
