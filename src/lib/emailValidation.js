/** Validación pragmática de email (RFC completo omitida a propósito). */
const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * @param {string} value
 */
export function isValidEmail(value) {
  const s = value.trim();
  if (s.length > 254 || s.length < 5) return false;
  return EMAIL_RE.test(s);
}
