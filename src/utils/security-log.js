// Registro de eventos de seguridad (login fallido, bloqueos, acciones admin).
// Escribe en consola y, si existe, en data/security.log (una línea JSON por evento).
const fs = require("fs");
const path = require("path");
const { DB_FILE } = require("../../config");

const LOG_FILE = path.join(path.dirname(DB_FILE), "security.log");
const MAX_LINE = 500;

function write(level, event, detail = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...detail,
  };
  const line = JSON.stringify(entry).slice(0, MAX_LINE);
  // Consola legible
  const msg = `[security] ${entry.ts} ${level.toUpperCase()} ${event}` +
    (detail.ip ? ` ip=${detail.ip}` : "") +
    (detail.login ? ` login=${detail.login}` : "") +
    (detail.role ? ` role=${detail.role}` : "") +
    (detail.reason ? ` reason=${detail.reason}` : "");
  if (level === "warn" || level === "error") console.warn(msg);
  else console.log(msg);
  // Archivo (best-effort; no debe romper la petición)
  try {
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch (_) { /* ignore */ }
}

const securityLog = {
  info: (event, detail) => write("info", event, detail),
  warn: (event, detail) => write("warn", event, detail),
  error: (event, detail) => write("error", event, detail),
};

module.exports = { securityLog, LOG_FILE };