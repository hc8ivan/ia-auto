import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "../config/env.js";
import { applyDatabaseSchema } from "./schemaApply.js";

/** @type {Database.Database | null} */
let db = null;

export function initDatabase() {
  const dir = path.dirname(config.databasePath);
  fs.mkdirSync(dir, { recursive: true });

  db = new Database(config.databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  applyDatabaseSchema(db);
  return db;
}

/** @returns {Database.Database} */
export function getDb() {
  if (!db) {
    throw new Error("Base de datos no inicializada. Llama a initDatabase() al arrancar.");
  }
  return db;
}

export function databaseHealthCheck() {
  try {
    if (!db) return false;
    db.prepare("SELECT 1").get();
    return true;
  } catch {
    return false;
  }
}

/** PRAGMA foreign_key_check: sin filas si la integridad referencial es correcta. */
export function databaseForeignKeysOk() {
  try {
    if (!db) return false;
    const rows = db.prepare("PRAGMA foreign_key_check").all();
    return rows.length === 0;
  } catch {
    return false;
  }
}

/** Cierra SQLite de forma ordenada (deploy / SIGTERM). */
export function closeDatabase() {
  if (!db) return;
  try {
    db.close();
  } catch {
    /* ignore */
  }
  db = null;
}
