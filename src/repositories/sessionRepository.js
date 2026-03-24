import { getDb } from "../db/database.js";

/**
 * @param {string} sessionId
 * @param {{ name: string, phone: string, email: string }} contact
 */
export function updateSessionContact(sessionId, { name, phone, email }) {
  getDb()
    .prepare(
      `UPDATE sessions
       SET customer_name = @name,
           customer_phone = @phone,
           customer_email = @email,
           updated_at = datetime('now')
       WHERE id = @id`,
    )
    .run({
      id: sessionId,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
    });
}
