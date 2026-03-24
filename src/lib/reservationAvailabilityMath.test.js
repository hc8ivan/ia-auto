import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  intervalsOverlap,
  sumTablesUsedDuring,
  freeTables,
} from "./reservationAvailabilityMath.js";

function hhmm(m) {
  const h = Math.floor(m / 60);
  const mi = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

describe("intervalsOverlap", () => {
  it("detecta solape parcial", () => {
    assert.equal(intervalsOverlap(60, 120, 90, 150), true);
  });
  it("no solapa cuando termina justo al empezar el otro", () => {
    assert.equal(intervalsOverlap(60, 120, 120, 180), false);
  });
});

describe("sumTablesUsedDuring", () => {
  it("suma mesas de reservas que solapan el intervalo", () => {
    const rows = [
      { start_time: "13:00", duration_minutes: 90, tables_used: 2 },
      { start_time: "15:00", duration_minutes: 60, tables_used: 1 },
    ];
    const used = sumTablesUsedDuring(rows, 13 * 60 + 30, 14 * 60 + 30, (s) => {
      const [h, m] = s.split(":").map(Number);
      return h * 60 + m;
    });
    assert.equal(used, 2);
  });
});

describe("freeTables", () => {
  it("resta usadas del total", () => {
    assert.equal(freeTables(15, 5), 10);
  });
});
