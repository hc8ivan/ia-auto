/**
 * Cálculo puro de solapes de reservas (testable sin BD).
 */

export function intervalsOverlap(a0, a1, b0, b1) {
  return a0 < b1 && b0 < a1;
}

/**
 * @param {Array<{ start_time: string, duration_minutes: number, tables_used: number }>} rows
 * @param {number} startMin inicio del intervalo candidato (minutos desde medianoche)
 * @param {number} endMin fin exclusivo o inclusivo según overlaps — aquí fin exclusivo del slot reservado
 * @param {(s: string) => number | null} hhmmToMinutes
 */
export function sumTablesUsedDuring(rows, startMin, endMin, hhmmToMinutes) {
  let sum = 0;
  for (const r of rows) {
    const s = hhmmToMinutes(r.start_time);
    if (s === null) continue;
    const e = s + r.duration_minutes;
    if (intervalsOverlap(startMin, endMin, s, e)) {
      sum += r.tables_used;
    }
  }
  return sum;
}

/**
 * @param {number} totalTables
 * @param {number} used
 */
export function freeTables(totalTables, used) {
  return totalTables - used;
}
