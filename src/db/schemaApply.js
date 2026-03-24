/**
 * Esquema SQLite + migraciones versionadas.
 * - Timestamps: SQLite datetime('now') en UTC.
 * - Texto: mensajes y nombres en UTF-8; fechas de reserva YYYY-MM-DD; hora HH:mm.
 */

/**
 * @param {import("better-sqlite3").Database} db
 * @param {string} table
 * @param {string} column
 */
function columnExists(db, table, column) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all();
  return rows.some((c) => c.name === column);
}

/**
 * @param {import("better-sqlite3").Database} db
 * @param {string} version
 * @param {(d: import("better-sqlite3").Database) => void} fn
 */
function migrate(db, version, fn) {
  const done = db
    .prepare("SELECT 1 AS ok FROM schema_migrations WHERE version = ?")
    .get(version);
  if (done) return;
  const tx = db.transaction(() => {
    fn(db);
    db.prepare("INSERT INTO schema_migrations (version) VALUES (?)").run(version);
  });
  tx();
}

const CORE_DDL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TRIGGER IF NOT EXISTS trg_messages_touch_session
AFTER INSERT ON messages
BEGIN
  UPDATE sessions SET updated_at = datetime('now') WHERE id = NEW.session_id;
END;

CREATE TABLE IF NOT EXISTS opening_hours (
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  lunch_open TEXT,
  lunch_close TEXT,
  dinner_open TEXT,
  dinner_close TEXT,
  is_closed INTEGER NOT NULL DEFAULT 0 CHECK (is_closed IN (0, 1)),
  PRIMARY KEY (weekday)
);

CREATE TABLE IF NOT EXISTS calendar_exceptions (
  exception_date TEXT NOT NULL,
  is_closed INTEGER NOT NULL DEFAULT 1 CHECK (is_closed IN (0, 1)),
  lunch_open TEXT,
  lunch_close TEXT,
  dinner_open TEXT,
  dinner_close TEXT,
  note TEXT,
  PRIMARY KEY (exception_date)
);

CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  reservation_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  party_size INTEGER NOT NULL,
  tables_used INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  session_id TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS business_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);
`;

const INDEX_DDL = `
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages (session_id, id);
CREATE INDEX IF NOT EXISTS idx_messages_session_created ON messages (session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_range ON calendar_exceptions (exception_date);
CREATE INDEX IF NOT EXISTS idx_reservations_date_status ON reservations (reservation_date, status);
CREATE INDEX IF NOT EXISTS idx_reservations_date_time ON reservations (reservation_date, start_time);
CREATE INDEX IF NOT EXISTS idx_reservations_session ON reservations (session_id);
CREATE INDEX IF NOT EXISTS idx_business_events_session_created ON business_events (session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_business_events_type_created ON business_events (event_type, created_at);
`;

/**
 * @param {import("better-sqlite3").Database} db
 */
export function applyDatabaseSchema(db) {
  db.exec(CORE_DDL);
  db.exec(INDEX_DDL);

  migrate(db, "20250324_sessions_contact", (d) => {
    if (!columnExists(d, "sessions", "customer_name")) {
      d.exec("ALTER TABLE sessions ADD COLUMN customer_name TEXT;");
    }
    if (!columnExists(d, "sessions", "customer_phone")) {
      d.exec("ALTER TABLE sessions ADD COLUMN customer_phone TEXT;");
    }
    if (!columnExists(d, "sessions", "locale")) {
      d.exec("ALTER TABLE sessions ADD COLUMN locale TEXT DEFAULT 'es';");
    }
    if (!columnExists(d, "sessions", "channel")) {
      d.exec(
        "ALTER TABLE sessions ADD COLUMN channel TEXT NOT NULL DEFAULT 'web';",
      );
    }
  });

  migrate(db, "20250324_reservations_audit_columns", (d) => {
    if (!columnExists(d, "reservations", "notes")) {
      d.exec("ALTER TABLE reservations ADD COLUMN notes TEXT;");
    }
    if (!columnExists(d, "reservations", "updated_at")) {
      // ALTER ADD no admite DEFAULT datetime('now') en SQLite (valor no constante).
      d.exec("ALTER TABLE reservations ADD COLUMN updated_at TEXT;");
      d.exec(
        "UPDATE reservations SET updated_at = datetime('now') WHERE updated_at IS NULL;",
      );
    }
  });

  migrate(db, "20250325_contact_email", (d) => {
    if (!columnExists(d, "reservations", "customer_email")) {
      d.exec("ALTER TABLE reservations ADD COLUMN customer_email TEXT;");
    }
    if (!columnExists(d, "sessions", "customer_email")) {
      d.exec("ALTER TABLE sessions ADD COLUMN customer_email TEXT;");
    }
  });
}
