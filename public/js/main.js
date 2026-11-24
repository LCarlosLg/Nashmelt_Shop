import { state, setProducts } from "./state.js";
import { fetchMe, fetchProducts, fetchState, setUnauthorizedHandler } from "./api.js";
import { $, initOverlay, closeAll, toast } from "./utils.js";
import { badges, drawCart, initCart, applyState } from "./cart.js";
import { initCatalog, render, setupFilters } from "./catalog.js";
import { initAuth, ui, isAdminRoute, setSessionHook } from "./auth.js";
import { initAdmin, admR } from "./admin.js";

const isAdmin = () => !!state.USER && state.USER.role === "admin";

// Tienda (#) o panel de administración (#admin)
function route() {
  if (isAdminRoute()) {
    closeAll(); ui();
    $("agate").hidden = isAdmin();
    $("admin").hidden = !isAdmin();
    if (isAdmin()) admR();
  } else {
    $("agate").hidden = true;
    $("admin").hidden = true;
    ui(); drawCart(); render();
  }
}

// Carga lo que depende de quién inició sesión: catálogo, carrito y favoritos
async function loadData() {
  let products = [], st = { cart: [], favs: [] };
  try { [products, st] = await Promise.all([fetchProducts(), fetchState()]); }
  catch (e) { toast(e.message); }
  setProducts(products);
  setupFilters();
  applyState(st);
}

// Sin sesión no queda nada en pantalla (ni catálogo, ni carrito, ni datos del admin)
function clearData() {
  setProducts([]);
  setupFilters();
  state.cart = []; state.fav = []; state.dirty = false;
  state.AE = { tab: "inv", q: "", f: null, del: null, customers: null };
}

// Pregunta al servidor quién es el usuario de la cookie y deja la pantalla en consecuencia
async function establish() {
  try { state.USER = await fetchMe(); }
  catch (e) { state.USER = null; toast(e.message); }
  if (state.USER) await loadData(); else clearData();
  badges();
  route();
}

async function start() {
  initOverlay();
  initCatalog();
  initCart();
  initAuth();
  initAdmin();

  setSessionHook(establish);
  setUnauthorizedHandler(() => {          // el servidor respondió 401: la sesión venció
    if (!state.USER) return;
    state.USER = null;
    clearData();
    toast("Tu sesión expiró. Inicia sesión de nuevo.");
    badges(); route();
  });
  addEventListener("hashchange", route);
  await establish();
}

start();
