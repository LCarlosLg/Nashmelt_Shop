import { CFG, PATH } from "./config.js";

// Estado compartido de la aplicación (un solo objeto; todos los módulos lo importan)
export const state = {
  P: [],            // productos
  minP: 0, maxP: 0, // rango de precios del catálogo
  S: null,          // filtros activos
  cart: [], fav: [],
  // modal de producto
  cur: null, selS: "", qty: 1,
  // sesión: { id, role: "customer" | "admin", name, email, phone } o null (la valida el servidor con la cookie)
  USER: null,
  // panel admin
  dirty: false,
  AE: { tab: "inv", q: "", f: null, del: null, customers: null },
};

export function defaultFilters() {
  return {
    q: "", cat: "Todo", min: state.minP, max: state.maxP, sz: "", col: "",
    off: false, favOnly: false, nw: false, sort: "pop", n: CFG.page,
  };
}

// ---------- Productos: helpers ----------
export const isNew = (p) => !!p.added && Date.now() - p.added < 7 * 864e5;
export const units = (p) => p.sizes.reduce((a, s) => a + (+p.stock[s] || 0), 0);
export const pid = (id) => state.P.filter((p) => p.id === id)[0];
export const nid = () => state.P.reduce((m, p) => Math.max(m, p.id), 0) + 1;

// Carga los productos en el estado y calcula el rango de precios del filtro
export function setProducts(data) {
  const P = data || [];
  P.forEach((p) => {
    p.stock = p.stock || {};
    p.sizes = p.sizes || [];
    if (!p.img) p.img = art(p.cat, p.hex, p.id);
  });
  state.P = P;
  const prices = P.map((p) => p.price);
  state.maxP = Math.max.apply(null, [100].concat(prices));
  state.minP = Math.min.apply(null, [state.maxP].concat(prices));
}

// ---------- Imagen de reemplazo ----------
// Imagen de reemplazo (SVG) para productos sin foto
export function art(cat, hex, i) {
  const s =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 270"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#fff4f0"/><stop offset="1" stop-color="#f3dfe8"/></linearGradient></defs>' +
    '<rect width="200" height="270" fill="url(#g)"/><path d="' + PATH[cat] + '" fill="' + hex +
    '" stroke="rgba(0,0,0,.18)" stroke-width="2" transform="translate(0,' + (i % 3 * 4) + ')"/></svg>';
  return "data:image/svg+xml;utf8," + encodeURIComponent(s);
}
