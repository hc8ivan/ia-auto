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
