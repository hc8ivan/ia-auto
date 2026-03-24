import { getDb } from "../db/database.js";

/**
 * @param {string} reservationDate YYYY-MM-DD
 */
export function listConfirmedForDate(reservationDate) {
  return getDb()
    .prepare(
      `SELECT id, reservation_date, start_time, duration_minutes, party_size, tables_used, status
       FROM reservations
       WHERE reservation_date = ? AND status = 'confirmed'`,
    )
    .all(reservationDate);
}

/**
 * @param {object} row
 */
/**
 * Evita doble inserción si el modelo invoca create_reservation dos veces seguidas (misma sesión y datos).
 * @param {string} sessionId
 * @param {string} reservationDate YYYY-MM-DD
 * @param {string} startTime HH:mm
 * @param {number} partySize
 * @param {number} windowSec ventana hacia atrás desde "now" (sanitizada en servicio)
 */
export function findRecentDuplicateForSession(
  sessionId,
  reservationDate,
  startTime,
  partySize,
  windowSec,
) {
  const mod = `-${Math.floor(windowSec)} seconds`;
  return getDb()
    .prepare(
      `SELECT id, reservation_date, start_time, duration_minutes, party_size, tables_used,
              customer_name, customer_phone, customer_email, session_id, status, created_at
       FROM reservations
       WHERE session_id = ?
         AND reservation_date = ?
         AND start_time = ?
         AND party_size = ?
         AND status = 'confirmed'
         AND created_at > datetime('now', ?)
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get(sessionId, reservationDate, startTime, partySize, mod);
}

export function insertReservation(row) {
  getDb()
    .prepare(
      `INSERT INTO reservations (
         id, reservation_date, start_time, duration_minutes, party_size, tables_used,
         customer_name, customer_phone, customer_email, session_id, status, notes, updated_at
       ) VALUES (
         @id, @reservation_date, @start_time, @duration_minutes, @party_size, @tables_used,
         @customer_name, @customer_phone, @customer_email, @session_id, 'confirmed',
         @notes, datetime('now')
       )`,
    )
    .run({
      ...row,
      customer_email: row.customer_email ?? null,
      notes: row.notes ?? null,
    });
}
