const path = require("path");
const ROOT = path.join(__dirname, "..");
const env = process.env;

// Contraseña inicial del admin: SOLO se usa la primera vez que arranca el servidor.
// Después cámbiala con: npm run admin:password -- "TuContraseñaLarga"
const DEFAULT_ADMIN_PASSWORD = "CambiaEstaClaveYA!";

module.exports = {
  PORT: env.PORT || 3000,
  HOST: env.HOST || "127.0.0.1",

  PUBLIC_DIR: path.join(ROOT, "public"),
  IMG_DIR: env.IMG_DIR || path.join(ROOT, "public", "img"),
  DB_FILE: env.DB_FILE || path.join(ROOT, "data", "nashmelt.db"),
  PRODUCTS_FILE: env.PRODUCTS_FILE || path.join(ROOT, "data", "products.json"),

  ADMIN_USER: (env.ADMIN_USER || "admin").toLowerCase(),
  ADMIN_PASSWORD: env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD,

  COOKIE_NAME: "nm_sid",
  TRUST_PROXY: env.TRUST_PROXY === "1",
  CUSTOMER_TTL: 7 * 24 * 3600e3,
  ADMIN_TTL: 2 * 3600e3,
  ADMIN_IDLE: 30 * 60e3,

  MAX_JSON: 5 * 1024 * 1024,
  MAX_BODY: 64 * 1024,
  MAX_IMAGE: 8 * 1024 * 1024,
  UPLOAD_PREFIX: "prod-",
  ORPHAN_MAX_AGE: 60 * 60 * 1000,

  MIME: {
    ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  },
};