import * as mailService from "../services/mailService.js";

/**
 * Estado SMTP para depuración (sin contraseñas).
 * GET /api/mail/status
 */
export function getMailStatus(_req, res) {
  const s = mailService.getMailConfigStatus();
  res.json({
    ...s,
    hint: s.ready
      ? "SMTP listo. Si no llega el correo, revise spam y la consola del servidor ([mail])."
      : `Falta configurar en .env: ${s.missing.join(", ")}. Ejemplo Gmail: SMTP_HOST=smtp.gmail.com SMTP_PORT=587 SMTP_SECURE=false SMTP_USER=su@gmail.com SMTP_PASS=contraseña_de_aplicación MAIL_FROM="ReservaFlow &lt;su@gmail.com&gt;"`,
  });
}
