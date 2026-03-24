import { getDb } from "../db/database.js";

/**
 * @param {object} p
 * @param {string | null | undefined} p.sessionId
 * @param {string} p.eventType ej. reservation.created
 * @param {string | null} [p.entityType]
 * @param {string | null} [p.entityId]
 * @param {Record<string, unknown> | null} [p.payload]
 */
export function insertBusinessEvent(p) {
  getDb()
    .prepare(
      `INSERT INTO business_events (session_id, event_type, entity_type, entity_id, payload_json)
       VALUES (@session_id, @event_type, @entity_type, @entity_id, @payload_json)`,
    )
    .run({
      session_id: p.sessionId ?? null,
      event_type: p.eventType,
      entity_type: p.entityType ?? null,
      entity_id: p.entityId ?? null,
      payload_json: p.payload ? JSON.stringify(p.payload) : null,
    });
}
