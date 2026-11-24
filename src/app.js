// Servidor HTTP: rutas de la API (con control de acceso) + archivos estáticos de /public
const http = require("http");
const fs = require("fs");
const path = require("path");
const { PUBLIC_DIR, IMG_DIR, MIME, TRUST_PROXY } = require("../config");
const { send, sendJson, fail } = require("./utils/http");
const { securityHeaders, checkOrigin } = require("./middleware/security");
const { getSession, requireUser, requireAdmin } = require("./middleware/auth");
const auth = require("./services/auth");
const account = require("./services/account");
const products = require("./services/products");
const images = require("./services/images");

const API = {
  "GET /api/auth/me":           [auth.me, "public"],
  "POST /api/auth/register":    [auth.register, "public"],
  "POST /api/auth/login":       [auth.login, "public"],
  "POST /api/auth/admin-login": [auth.adminLogin, "public"],
  "POST /api/auth/logout":      [auth.logout, "public"],

  // Catálogo público: los visitantes ven solo los productos visibles (products.list filtra los ocultos)
  "GET /api/products":          [products.list, "public"],
  "PUT /api/products":          [products.replace, "admin"],
  "POST /api/images":           [images.upload, "admin"],

  "GET /api/me/state":          [account.getState, "user"],
  "PUT /api/me/state":          [account.saveState, "user"],
  "POST /api/me/events":        [account.addEvent, "user"],

  "GET /api/admin/customers":   [account.customers, "admin"],
};

// Tipos de archivo que faltan en la tabla MIME de config.js (tipografías y manifiesto de la app)
const EXTRA_MIME = {
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

function isSecureRequest(req) {
  return !!req.socket.encrypted ||
    (TRUST_PROXY && req.headers["x-forwarded-proto"] === "https");
}

async function handleApi(req, res, pathname) {
  const route = API[req.method + " " + pathname];
  if (!route) return sendJson(res, 404, { error: "Ruta no encontrada" });

  const [handler, access] = route;

  if (req.method !== "GET") checkOrigin(req);

  const ctx = { user: getSession(req, res) };

  if (access === "user") requireUser(ctx);
  if (access === "admin") requireAdmin(ctx);

  await handler(req, res, ctx);
}

function serveStatic(req, res, pathname) {
  if (req.method !== "GET") return send(res, 405, "Método no permitido");
  let rel;
  try { rel = decodeURIComponent(pathname); } catch (e) { return send(res, 400, "Ruta inválida"); }
  if (rel === "/") rel = "/index.html";

  // Si es una imagen, priorizamos IMG_DIR (disco persistente en Render)
  // y si no está, buscamos en public/img (fotos que vienen en el repositorio)
  const isImage = rel.startsWith("/img/");
  const candidates = isImage
    ? [
        path.normalize(path.join(IMG_DIR, rel.slice(5))),
        path.normalize(path.join(PUBLIC_DIR, "img", rel.slice(5)))
      ]
    : [path.normalize(path.join(PUBLIC_DIR, rel))];

  const tryServe = (i) => {
    if (i >= candidates.length) return send(res, 404, "No encontrado");
    const file = candidates[i];

    // Seguridad: no permitir salir del directorio base
    const base = isImage
      ? (i === 0 ? IMG_DIR : path.join(PUBLIC_DIR, "img"))
      : PUBLIC_DIR;

    if (!file.startsWith(base + path.sep) && file !== base) {
      return send(res, 403, "Prohibido");
    }

    fs.readFile(file, (err, buf) => {
      if (err) return tryServe(i + 1);

      const cache = isImage
        ? "public, max-age=3600"
        : rel.startsWith("/fonts/")
          ? "public, max-age=604800"
          : "no-store";

      const ext = path.extname(file).toLowerCase();
      send(res, 200, buf, MIME[ext] || EXTRA_MIME[ext] || "application/octet-stream", cache);
    });
  };

  tryServe(0);
}

function createApp() {
  return http.createServer((req, res) => {
    securityHeaders(res, { secure: isSecureRequest(req) });

    const { pathname } = new URL(req.url, "http://localhost");
    if (pathname.startsWith("/api/")) {
      handleApi(req, res, pathname).catch((e) => {
        if (!e.status) console.error(e);
        sendJson(res, e.status || 500, { error: e.status ? e.message : "Error interno del servidor" });
      });
    } else {
      serveStatic(req, res, pathname);
    }
  });
}

module.exports = createApp;