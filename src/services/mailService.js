import nodemailer from "nodemailer";
import { config } from "../config/env.js";

/**
 * Listo para enviar: host, remitente y credenciales (salvo relay explícito sin auth).
 */
export function isMailConfigured() {
  const host = config.smtpHost?.trim();
  const from = config.mailFrom?.trim();
  if (!host || !from) {
    return false;
  }
  if (config.smtpAllowNoAuth) {
    return true;
  }
  const user = config.smtpUser?.trim();
  const pass = config.smtpPass?.trim();
  return Boolean(user && pass);
}

/**
 * Para diagnóstico (sin secretos).
 */
export function getMailConfigStatus() {
  const host = Boolean(config.smtpHost?.trim());
  const from = Boolean(config.mailFrom?.trim());
  const user = Boolean(config.smtpUser?.trim());
  const pass = Boolean(config.smtpPass?.trim());
  const allowNoAuth = config.smtpAllowNoAuth;
  const ready = isMailConfigured();
  /** @type {string[]} */
  const missing = [];
  if (!host) missing.push("SMTP_HOST");
  if (!from) missing.push("MAIL_FROM");
  if (!allowNoAuth && (!user || !pass)) missing.push("SMTP_USER y SMTP_PASS (o SMTP_ALLOW_NO_AUTH=true)");
  return {
    ready,
    smtpHostSet: host,
    mailFromSet: from,
    authSet: user && pass,
    smtpAllowNoAuth: allowNoAuth,
    missing: ready ? [] : missing,
    port: config.smtpPort,
    secure: config.smtpSecure,
  };
}

/**
 * @param {{ to: string, subject: string, text: string, html: string }} opts
 * @returns {Promise<{ sent: boolean, error?: string, messageId?: string }>}
 */
export async function sendTransactionalMail({ to, subject, text, html }) {
  if (!isMailConfigured()) {
    console.warn(
      "[mail] No se envía: falta configuración SMTP o credenciales. GET /api/mail/status para detalle.",
    );
    return { sent: false, error: "smtp_not_configured" };
  }

  /** Puerto 587 → STARTTLS (secure=false). Puerto 465 → SSL (secure=true). */
  const transporter = nodemailer.createTransport({
    host: config.smtpHost.trim(),
    port: config.smtpPort,
    secure: config.smtpSecure,
    requireTLS: !config.smtpSecure && config.smtpPort === 587,
    ...(config.smtpUser?.trim()
      ? {
          auth: {
            user: config.smtpUser.trim(),
            pass: config.smtpPass ?? "",
          },
        }
      : {}),
  });

  try {
    const info = await transporter.sendMail({
      from: config.mailFrom.trim(),
      to: to.trim(),
      subject,
      text,
      html,
    });
    console.log(
      `[mail] Correo enviado messageId=${info.messageId ?? "?"} -> ${to.trim()}`,
    );
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    const code = /** @type {{ code?: string }} */ (err).code;
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[mail] Fallo SMTP:", code ?? "", msg);
    return { sent: false, error: code ? `${code}: ${msg}` : msg };
  }
}

/**
 * @param {object} p
 * @param {string} p.to
 * @param {string} p.customerName
 * @param {object} p.reservation
 * @param {string} p.reservation.id
 * @param {string} p.reservation.date
 * @param {string} p.reservation.time
 * @param {number} p.reservation.partySize
 * @param {string} p.reservation.meal
 */
export async function sendReservationConfirmationEmail({
  to,
  customerName,
  reservation,
}) {
  const place = config.restaurantDisplayName;
  const subject = `${place} — Confirmación de su reserva`;

  const text = `Estimado/a ${customerName},

Le confirmamos su reserva en ${place}.

Localizador: ${reservation.id}
Fecha: ${reservation.date}
Hora: ${reservation.time}
Comensales: ${reservation.partySize}
Servicio: ${reservation.meal === "lunch" ? "comida" : "cena"}

Si necesita modificar o cancelar, le rogamos que nos contacte con la mayor brevedad posible indicando este localizador.

Un cordial saludo,
${place}`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"></head>
<body style="font-family:Georgia,serif;line-height:1.6;color:#222;max-width:560px;margin:0 auto;padding:24px">
  <p>Estimado/a <strong>${escapeHtml(customerName)}</strong>,</p>
  <p>Le confirmamos su reserva en <strong>${escapeHtml(place)}</strong>.</p>
  <table style="border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:6px 12px 6px 0;color:#555">Localizador</td><td><code>${escapeHtml(reservation.id)}</code></td></tr>
    <tr><td style="padding:6px 12px 6px 0;color:#555">Fecha</td><td>${escapeHtml(reservation.date)}</td></tr>
    <tr><td style="padding:6px 12px 6px 0;color:#555">Hora</td><td>${escapeHtml(reservation.time)}</td></tr>
    <tr><td style="padding:6px 12px 6px 0;color:#555">Comensales</td><td>${reservation.partySize}</td></tr>
    <tr><td style="padding:6px 12px 6px 0;color:#555">Servicio</td><td>${reservation.meal === "lunch" ? "Comida" : "Cena"}</td></tr>
  </table>
  <p style="font-size:14px;color:#444">Si necesita modificar o cancelar, le rogamos que nos contacte con la mayor brevedad posible indicando el localizador.</p>
  <p>Un cordial saludo,<br><strong>${escapeHtml(place)}</strong></p>
</body>
</html>`;

  return sendTransactionalMail({ to, subject, text, html });
}

/** @param {string} s */
function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
