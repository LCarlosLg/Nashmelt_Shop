import { state, defaultFilters, isNew, units, pid } from "./state.js";
import { CFG, CATS, COLORS, SIZES } from "./config.js";
import { $, esc, money, toast, panel, closeAll } from "./utils.js";
import { save, badges, drawCart } from "./cart.js";

// Filtros activos → sincroniza los controles con el estado
function syncUI() {
  const S = state.S;
  $("pmin").value = S.min; $("pmax").value = S.max;
  $("prL").textContent = money(S.min) + " – " + money(S.max);
  document.querySelectorAll("#chips .chip").forEach((c) =>
    c.classList.toggle("on", c.dataset.c === "Nuevo" ? S.nw : c.dataset.c === S.cat));
  document.querySelectorAll("[data-s]").forEach((c) => c.classList.toggle("on", c.dataset.s === S.sz));
  document.querySelectorAll("[data-k]").forEach((c) => c.classList.toggle("on", c.dataset.k === S.col));
  $("oOff").classList.toggle("on", S.off);
  $("favT").classList.toggle("on", S.favOnly);   // el corazón del encabezado se rellena cuando "solo favoritos" está activo
}

const SORTS = {
  pop: (a, b) => b.sold - a.sold,
  new: (a, b) => (b.added || 0) - (a.added || 0) || b.id - a.id,
  lo: (a, b) => a.price - b.price,
  hi: (a, b) => b.price - a.price,
};

// Productos visibles según búsqueda, filtros y orden
function list() {
  const S = state.S, q = S.q.toLowerCase().trim();
  return state.P.filter((p) =>
    p.active !== false && (S.cat === "Todo" || p.cat === S.cat) && p.price >= S.min && p.price <= S.max &&
    (!S.sz || p.sizes.indexOf(S.sz) > -1) && (!S.col || p.color === S.col) && (!S.off || p.old) &&
    (!S.nw || isNew(p)) && (!S.favOnly || state.fav.indexOf(p.id) > -1) &&
    (!q || (p.name + " " + p.cat + " " + p.color).toLowerCase().indexOf(q) > -1)
  ).sort(SORTS[S.sort]);
}

function cardHTML(p) {
  const isFav = state.fav.indexOf(p.id) > -1, u = units(p);
  return '<article class="card' + (u ? "" : " so") + '" data-id="' + p.id + '"><div class="pic" data-open="' + p.id +
    '"><img loading="lazy" alt="' + esc(p.name) + '" src="' + p.img + '">' + (isNew(p) ? '<span class="tag nw">NUEVO</span>' : "") +
    (p.old ? '<span class="tag">-' + Math.round((1 - p.price / p.old) * 100) + "%</span>" : "") +
    '<button class="fav' + (isFav ? " on" : "") + '" data-fav="' + p.id + '" aria-label="Favorito">' + (isFav ? "♥" : "♡") +
    '</button></div><div class="info"><div class="nm">' + esc(p.name) + '</div>' +
    (u > 0 && u <= 3 ? '<div class="rt">¡Últimas ' + u + "!</div>" : "") + '<div class="pr"><b>' + money(p.price) + "</b>" +
    (p.old ? "<s>" + money(p.old) + "</s>" : "") + '<button class="add" data-open="' + p.id + '" aria-label="Agregar">+</button></div></div></article>';
}

export function render() {
  syncUI();
  const r = list(), v = r.slice(0, state.S.n);
  $("cnt").textContent = r.length + " productos";
  $("grid").innerHTML = v.length ? v.map(cardHTML).join("") : '<div class="empty">No encontramos productos con esos filtros</div>';
  $("more").style.display = r.length > state.S.n ? "block" : "none";
}

// Cualquier cambio de filtro vuelve a la primera página
function change(fn) { fn(state.S); state.S.n = CFG.page; render(); }

// Deja los filtros en blanco y ajusta el rango de precios al catálogo cargado (se llama tras cada login)
export function setupFilters() {
  state.S = defaultFilters();
  $("q").value = ""; $("sort").value = "pop";
  ["pmin", "pmax"].forEach((id) => { const e = $(id); e.min = state.minP; e.max = state.maxP; e.step = 10; });
}

export function initCatalog() {
  initModal();
  $("chips").innerHTML = ["Todo", "Nuevo"].concat(CATS).map((c) =>
    '<button class="chip' + (c === "Todo" ? " on" : "") + '" data-c="' + c + '">' + c + "</button>").join("");
  $("fs").innerHTML = SIZES.map((s) => '<button class="opt" data-s="' + s + '">' + s + "</button>").join("");
  $("fc").innerHTML = COLORS.map((c) =>
    '<button class="sw" title="' + c[0] + '" data-k="' + c[0] + '" style="background:' + c[1] + '"></button>').join("");

  let tm;
  $("q").addEventListener("input", (e) => {
    clearTimeout(tm);
    tm = setTimeout(() => change((S) => { S.q = e.target.value; }), 180);
  });
  $("sort").onchange = (e) => { state.S.sort = e.target.value; render(); };
  $("more").onclick = () => { state.S.n += CFG.page; render(); };
  $("chips").onclick = (e) => {
    const c = e.target.dataset.c;
    if (c) change((S) => { if (c === "Nuevo") S.nw = !S.nw; else S.cat = c; });
  };
  $("pmin").oninput = (e) => change((S) => { S.min = Math.min(+e.target.value, S.max); });
  $("pmax").oninput = (e) => change((S) => { S.max = Math.max(+e.target.value, S.min); });
  $("fs").onclick = (e) => { const s = e.target.dataset.s; if (s) change((S) => { S.sz = S.sz === s ? "" : s; }); };
  $("fc").onclick = (e) => { const k = e.target.dataset.k; if (k) change((S) => { S.col = S.col === k ? "" : k; }); };
  $("oOff").onclick = () => change((S) => { S.off = !S.off; });
  $("favT").onclick = () => { change((S) => { S.favOnly = !S.favOnly; }); scrollTo({ top: 0, behavior: "smooth" }); };
  $("reset").onclick = () => { setupFilters(); render(); };
  $("fo").onclick = () => panel(true);
  $("fx").onclick = () => panel(false);

  // favoritos y apertura del detalle
  $("grid").onclick = (e) => {
    const f = e.target.closest("[data-fav]");
    if (f) {
      e.stopPropagation();
      const id = +f.dataset.fav, k = state.fav.indexOf(id);
      k > -1 ? state.fav.splice(k, 1) : state.fav.push(id);
      save(); badges(); render();
      return;
    }
    const o = e.target.closest("[data-open]");
    if (o) openModal(+o.dataset.open);
  };
}

// ---------- Modal de producto (talla y cantidad) ----------
// Ventana de detalle del producto (elegir talla y cantidad)
function openModal(id) {
  state.cur = pid(id);
  state.selS = state.cur.sizes.filter((s) => state.cur.stock[s] > 0)[0] || "";
  state.qty = 1;
  drawModal();
  $("modal").classList.add("show");
  $("ov").classList.add("show");
}

function drawModal() {
  const p = state.cur, { selS, qty } = state;
  $("modal").innerHTML =
    '<div class="mimg" data-zoom role="button" tabindex="0" aria-label="Ver la foto completa"><img alt="' + esc(p.name) + '" src="' + p.img + '"><span class="zh">' + ZOOM_IC + 'Ver completa</span></div><div class="mb"><button style="justify-self:end;font-size:22px" id="mx" aria-label="Cerrar">×</button><h2>' +
    esc(p.name) + '</h2><div class="pr"><b style="font-size:22px">' + money(p.price) + "</b>" + (p.old ? "<s>" + money(p.old) + "</s>" : "") +
    '</div><div class="rt">Color: ' + p.color + "</div>" + (p.desc ? "<div>" + esc(p.desc) + "</div>" : "") +
    '<div><h3 style="margin:0 0 6px;font-size:14px">Talla</h3><div class="opts">' +
    p.sizes.map((s) => '<button class="opt' + (s === selS ? " on" : "") + '" data-ms="' + s + '"' + (p.stock[s] > 0 ? "" : " disabled") + ">" +
      s + (p.stock[s] > 0 && p.stock[s] <= 3 ? " (" + p.stock[s] + ")" : "") + "</button>").join("") +
    '</div></div><div class="q"><button data-mq="-1">−</button><b>' + qty + '</b><button data-mq="1">+</button></div><button class="wa" id="madd"' +
    (selS ? "" : " disabled") + ">" + (selS ? "Guardar en mi pedido" : "Agotado") + "</button></div>";
}

// ---------- Foto completa (visor) ----------
const ZOOM_IC = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M11 8v6M8 11h6"/></svg>';

// Muestra la foto del producto completa, sin recortes. Se cierra con un toque, con la X o con Esc.
function openZoom(p) {
  const prev = document.activeElement, z = document.createElement("div");
  z.className = "zoom";
  z.setAttribute("role", "dialog");
  z.setAttribute("aria-modal", "true");
  z.setAttribute("aria-label", "Foto ampliada de " + p.name);
  z.innerHTML = '<button class="zx" type="button" aria-label="Cerrar foto">×</button><img alt="' + esc(p.name) + '" src="' + p.img + '">';
  const done = () => {
    document.removeEventListener("keydown", onKey, true);
    z.remove();
    if (prev && prev.focus) prev.focus();
  };
  const onKey = (e) => { if (e.key === "Escape") { e.stopImmediatePropagation(); e.preventDefault(); done(); } };   // Esc cierra solo el visor, no el modal
  z.onclick = done;
  document.addEventListener("keydown", onKey, true);
  document.body.appendChild(z);
  z.querySelector(".zx").focus();
}

function initModal() {
  $("modal").onkeydown = (e) => {   // teclado: Enter o espacio sobre la foto
    if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-zoom]")) { e.preventDefault(); openZoom(state.cur); }
  };
  $("modal").onclick = (e) => {
    const t = e.target, p = state.cur;
    if (t.closest && t.closest("[data-zoom]")) { openZoom(p); return; }
    if (t.id === "mx") closeAll();
    if (t.dataset.ms) { state.selS = t.dataset.ms; drawModal(); }
    if (t.dataset.mq) {
      state.qty = Math.min(Math.max(p.stock[state.selS] || 1, 1), Math.max(1, state.qty + +t.dataset.mq));
      drawModal();
    }
    if (t.id === "madd") {
      const { selS, qty } = state;
      const it = state.cart.filter((c) => c.id === p.id && c.size === selS)[0];
      if ((it ? it.qty : 0) + qty > (p.stock[selS] || 0)) { toast("Solo hay " + p.stock[selS] + " disponibles"); return; }
      it ? (it.qty += qty) : state.cart.push({ id: p.id, size: selS, qty });
      save(); badges(); drawCart(); closeAll(); toast("Agregado a tu pedido ✓");
    }
  };
}