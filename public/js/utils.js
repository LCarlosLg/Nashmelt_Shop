import { CFG } from "./config.js";

export const $ = (id) => document.getElementById(id);

export function esc(t) {
  return String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

export const money = (n) => CFG.cur + n.toLocaleString("es-MX");

export function toast(m) {
  const t = $("toast");
  t.textContent = m;
  t.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("show"), 1800);
}

/* ===== Paneles flotantes: filtros (móvil), carrito, modal y fondo oscuro ===== */
export function panel(open) {
  $("filters").classList.toggle("open", open);
  $("ov").classList.toggle("show", open);
}
export function cartOpen(o) {
  $("drawer").classList.toggle("open", o);
  $("ov").classList.toggle("show", o);
}
export function closeAll() {
  cartOpen(false);
  panel(false);
  $("modal").classList.remove("show");
  $("ov").classList.remove("show");
}
export function initOverlay() {
  $("ov").onclick = closeAll;
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });
}
