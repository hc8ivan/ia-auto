import { config } from "../config/env.js";

function ts() {
  return new Date().toISOString();
}

/**
 * @param {string} level
 * @param {string} msg
 * @param {Record<string, unknown>} [extra]
 */
function out(level, msg, extra) {
  const base = { ts: ts(), level, msg, env: config.nodeEnv };
  const line =
    extra && Object.keys(extra).length > 0
      ? JSON.stringify({ ...base, ...extra })
      : JSON.stringify(base);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  /** @param {string} msg @param {Record<string, unknown>} [extra] */
  info(msg, extra) {
    out("info", msg, extra);
  },
  /** @param {string} msg @param {Record<string, unknown>} [extra] */
  warn(msg, extra) {
    out("warn", msg, extra);
  },
  /** @param {string} msg @param {Record<string, unknown>} [extra] */
  error(msg, extra) {
    out("error", msg, extra);
  },
};
