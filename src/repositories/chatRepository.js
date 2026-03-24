import { randomUUID } from "node:crypto";
import { getDb } from "../db/database.js";

/**
 * Crea sesión nueva o devuelve la existente.
 * @param {string | undefined} sessionId UUID existente
 * @returns {string} id de sesión
 */
export function ensureSession(sessionId) {
  const conn = getDb();
  if (sessionId) {
    const row = conn
      .prepare("SELECT id FROM sessions WHERE id = ?")
      .get(sessionId);
    if (row) return row.id;
  }
  const id = randomUUID();
  conn.prepare("INSERT INTO sessions (id) VALUES (?)").run(id);
  return id;
}

/**
 * @param {string} sessionId
 * @param {'user' | 'assistant'} role
 * @param {string} content
 */
export function insertMessage(sessionId, role, content) {
  getDb()
    .prepare(
      "INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)",
    )
    .run(sessionId, role, content);
}

/**
 * Últimos `limit` mensajes en orden cronológico (excluye system; solo user|assistant).
 * @param {string} sessionId
 * @param {number} limit
 * @returns {{ role: 'user' | 'assistant', content: string }[]}
 */
export function getRecentMessages(sessionId, limit) {
  const rows = getDb()
    .prepare(
      `SELECT role, content FROM messages
       WHERE session_id = ?
       ORDER BY id DESC
       LIMIT ?`,
    )
    .all(sessionId, limit);

  return rows.reverse().map((r) => ({
    role: /** @type {'user' | 'assistant'} */ (r.role),
    content: r.content,
  }));
}

/**
 * Todos los mensajes de la sesión, en orden (para rehidratar el cliente).
 * @param {string} sessionId
 */
export function getAllMessages(sessionId) {
  const row = getDb()
    .prepare("SELECT id FROM sessions WHERE id = ?")
    .get(sessionId);
  if (!row) return null;

  return getDb()
    .prepare(
      `SELECT role, content FROM messages WHERE session_id = ? ORDER BY id ASC`,
    )
    .all(sessionId)
    .map((r) => ({
      role: /** @type {'user' | 'assistant'} */ (r.role),
      content: r.content,
    }));
}
