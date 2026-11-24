// Productos: lectura/escritura de data/products.json y sus endpoints
const fs = require("fs");
const { PRODUCTS_FILE, MAX_JSON } = require("../../config");
const { sendJson, readJson, fail } = require("../utils/http");
const { removeOrphans } = require("./images");

function readAll() {
  return fs.existsSync(PRODUCTS_FILE) ? JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8")) : [];
}

const MAX_EXTRA_IMGS = 5;   // fotos adicionales por producto (además de la principal)

function validate(list) {
  if (!Array.isArray(list)) throw fail(400, "Se esperaba una lista de productos");
  const ids = new Set();
  list.forEach((p, i) => {
    const ok = p && typeof p === "object" && Number.isFinite(p.id) && typeof p.name === "string" && p.name.trim() &&
      Number.isFinite(p.price) && p.price >= 0;
    if (!ok) throw fail(400, "Producto inválido en la posición " + i);
    // Fotos adicionales (opcional): lista de rutas /img/... ya subidas al servidor
    if (p.imgs !== undefined) {
      const okImgs = Array.isArray(p.imgs) && p.imgs.length <= MAX_EXTRA_IMGS &&
        p.imgs.every((u) => typeof u === "string" && /^\/img\/[\w.-]+$/.test(u));
      if (!okImgs) throw fail(400, "Fotos adicionales inválidas en la posición " + i);
    }
    if (ids.has(p.id)) throw fail(400, "ID repetido: " + p.id);
    ids.add(p.id);
  });
}

function writeAll(list) {
  validate(list);
  if (fs.existsSync(PRODUCTS_FILE)) fs.copyFileSync(PRODUCTS_FILE, PRODUCTS_FILE + ".bak"); // respaldo de la versión anterior
  const tmp = PRODUCTS_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
  fs.renameSync(tmp, PRODUCTS_FILE); // escritura atómica
  removeOrphans(list);
}

// GET /api/products — catálogo público: visitantes y clientes solo reciben los productos visibles;
// el admin (con sesión) recibe todos. ctx.user es null cuando no hay sesión.
function list(req, res, ctx) {
  const all = readAll();
  const isAdmin = !!ctx.user && ctx.user.role === "admin";
  sendJson(res, 200, isAdmin ? all : all.filter((p) => p.active !== false));
}

// PUT /api/products  (solo admin: reemplaza todo el catálogo)
async function replace(req, res) {
  writeAll(await readJson(req, MAX_JSON));
  sendJson(res, 200, { ok: true });
}

module.exports = { list, replace };