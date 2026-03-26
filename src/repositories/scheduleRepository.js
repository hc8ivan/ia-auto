import { getDb } from "../db/database.js";

/** @typedef {{ weekday: number, lunch_open: string | null, lunch_close: string | null, dinner_open: string | null, dinner_close: string | null, is_closed: number }} OpeningRow */
/** @typedef {{ exception_date: string, is_closed: number, lunch_open: string | null, lunch_close: string | null, dinner_open: string | null, dinner_close: string | null, note: string | null }} ExceptionRow */

/**
 * @returns {Map<number, OpeningRow>}
 */
export function getWeeklyHoursMap() {
  const rows = getDb()
    .prepare(
      `SELECT weekday, lunch_open, lunch_close, dinner_open, dinner_close, is_closed
       FROM opening_hours`,
    )
    .all();
  return new Map(rows.map((r) => [r.weekday, r]));
}

/**
 * @param {string} startYmd
 * @param {string} endYmd
 * @returns {ExceptionRow[]}
 */
export function getExceptionsBetween(startYmd, endYmd) {
  return getDb()
    .prepare(
      `SELECT exception_date, is_closed, lunch_open, lunch_close, dinner_open, dinner_close, note
       FROM calendar_exceptions
       WHERE exception_date >= @start AND exception_date <= @end
       ORDER BY exception_date`,
    )
    .all({ start: startYmd, end: endYmd });
}

export function countOpeningHours() {
  const row = getDb().prepare(`SELECT COUNT(*) AS n FROM opening_hours`).get();
  return row?.n ?? 0;
}

/** Valores por defecto del restaurante: los 7 días, comida y cena (editable en BD / SQL). */
export function seedOpeningHoursIfEmpty() {
  if (countOpeningHours() > 0) return;

  const insert = getDb().prepare(
    `INSERT INTO opening_hours (weekday, lunch_open, lunch_close, dinner_open, dinner_close, is_closed)
     VALUES (@weekday, @lunch_open, @lunch_close, @dinner_open, @dinner_close, @is_closed)`,
  );

  const tx = getDb().transaction(() => {
    for (let weekday = 0; weekday <= 6; weekday++) {
      insert.run({
        weekday,
        lunch_open: "13:00",
        lunch_close: "16:00",
        dinner_open: "20:00",
        dinner_close: "23:00",
        is_closed: 0,
      });
    }
  });
  tx();
}
