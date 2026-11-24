// Datos de cada usuario: carrito, favoritos y actividad. Más el listado de clientes para el admin.
const { q, logActivity } = require("../db");
const { sendJson, fail, readJson } = require("../utils/http");
const { MAX_BODY } = require("../../config");

const isInt = (n) => Number.isInteger(n);

function cleanCart(a) {
  if (!Array.isArray(a) || a.length > 200) throw fail(400, "Carrito inválido");
  return a.map((i) => {
    const id = Number(i && i.id), qty = Number(i && i.qty), size = String((i && i.size) || "").slice(0, 10);
    if (!isInt(id) || !isInt(qty) || qty < 1 || qty > 99 || !size) throw fail(400, "Carrito inválido");
    return { id, size, qty };
  });
}

function cleanFavs(a) {
  if (!Array.isArray(a) || a.length > 500) throw fail(400, "Favoritos inválidos");
  const ids = a.map(Number);
  if (!ids.every(isInt)) throw fail(400, "Favoritos inválidos");
  return [...new Set(ids)];
}

// GET /api/me/state
function getState(req, res, ctx) {
  const row = q.getState.get(ctx.user.id);
  sendJson(res, 200, row ? { cart: JSON.parse(row.cart), favs: JSON.parse(row.favs) } : { cart: [], favs: [] });
}

// PUT /api/me/state
async function saveState(req, res, ctx) {
  const b = await readJson(req, MAX_BODY);
  q.saveState.run(ctx.user.id, JSON.stringify(cleanCart(b.cart)), JSON.stringify(cleanFavs(b.favs)), Date.now());
  sendJson(res, 200, { ok: true });
}

// POST /api/me/events  — el cliente avisa de acciones que el servidor no puede ver (hoy: "order")
async function addEvent(req, res, ctx) {
  const b = await readJson(req, MAX_BODY);
  if (b.type !== "order") throw fail(400, "Evento no permitido");
  const d = b.detail || {};
  const items = Number(d.items), total = Number(d.total);
  if (!isInt(items) || items < 0 || items > 999 || !Number.isFinite(total) || total < 0 || total > 1e9) throw fail(400, "Datos inválidos");
  logActivity(ctx.user.id, "order", { items, total });
  sendJson(res, 201, { ok: true });
}

// GET /api/admin/customers
function customers(req, res) {
  sendJson(res, 200, q.customers.all().map((c) => ({
    id: c.id, name: c.name, email: c.email, phone: c.phone,
    createdAt: c.created_at, lastLoginAt: c.last_login_at, lastSeenAt: c.last_seen_at, orders: c.orders,
  })));
}

module.exports = { getState, saveState, addEvent, customers };
