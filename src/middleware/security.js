const { fail } = require("../utils/http");

/**
 * Cabeceras de seguridad en todas las respuestas.
 * - CSP: solo mismo origen (+ data/blob para imágenes SVG de relleno).
 * - HSTS solo si la petición ya llega por HTTPS (o detrás de proxy con TRUST_PROXY=1).
 */
function securityHeaders(res, opts = {}) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' data: blob:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ")
  );
  if (opts.secure) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}

/** Protección CSRF básica: Origin debe coincidir con Host en métodos que modifican datos. */
function checkOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  let host;
  try {
    host = new URL(origin).host;
  } catch {
    throw fail(403, "Origen no permitido");
  }
  if (host !== req.headers.host) {
    throw fail(403, "Origen no permitido");
  }
}

module.exports = { securityHeaders, checkOrigin };