import { state, pid } from "./state.js";
import { saveState, postEvent } from "./api.js";
import { CFG } from "./config.js";
import { $, esc, money, cartOpen } from "./utils.js";

// Carrito y favoritos: viven en la base de datos de cada usuario (tabla user_state).
// Se cargan al iniciar sesión y se guardan solos unos instantes después de cada cambio.
let synced = "", timer;
const snapshot = () => JSON.stringify([state.cart, state.fav]);

export function applyState(st) {
  state.cart = st.cart || [];
  state.fav = st.favs || [];
  synced = snapshot();
}

export function save() {
  if (!state.USER || snapshot() === synced) return;
  clearTimeout(timer);
  timer = setTimeout(flush, 600);
}

// Envía ya los cambios pendientes (también al cerrar sesión o la pestaña)
export async function flush() {
  clearTimeout(timer);
  const snap = snapshot();
  if (!state.USER || snap === synced) return;
  try { await saveState(state.cart, state.fav); synced = snap; }
  catch (e) { /* se reintenta con el siguiente cambio */ }
}

export function badges() {
  const n = state.cart.reduce((a, c) => a + c.qty, 0);
  $("cartN").textContent = n; $("cartN").hidden = !n;
  $("favN").textContent = state.fav.length; $("favN").hidden = !state.fav.length;
}

export function drawCart() {
  let tot = 0;
  state.cart = state.cart.filter((c) => pid(c.id));
  $("dl").innerHTML = state.cart.length
    ? state.cart.map((c, i) => {
        const p = pid(c.id); tot += p.price * c.qty;
        return '<div class="it"><img alt="" src="' + p.img + '"><div><div>' + esc(p.name) + "</div><small>Talla " + esc(c.size) +
          " · " + money(p.price) + '</small><div class="q"><button data-d="' + i + '" data-v="-1">−</button><b>' + c.qty +
          '</b><button data-d="' + i + '" data-v="1">+</button></div></div><button data-rm="' + i +
          '" aria-label="Quitar" style="font-size:18px">🗑</button></div>';
      }).join("")
    : '<div class="empty">Tu pedido está vacío.<br>Agrega productos con el botón +</div>';
  $("tot").textContent = money(tot);
  $("wa").disabled = !state.cart.length;
  save(); badges();
}

export function initCart() {
  $("dl").onclick = (e) => {
    const t = e.target;
    if (t.dataset.d) {
      const c = state.cart[+t.dataset.d];
      c.qty = Math.min(c.qty + +t.dataset.v, Math.max(pid(c.id).stock[c.size] || 0, 1));
      if (c.qty < 1) state.cart.splice(+t.dataset.d, 1);
      drawCart();
    }
    if (t.dataset.rm) { state.cart.splice(+t.dataset.rm, 1); drawCart(); }
  };
  $("clr").onclick = () => { state.cart = []; drawCart(); };
  $("cartT").onclick = () => { drawCart(); cartOpen(true); };
  $("dx").onclick = () => cartOpen(false);
  initWhatsApp();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
}

// ---------- Pedido por WhatsApp ----------
// Pedido por WhatsApp (wa.me solo admite texto: las imágenes van como enlaces)
function initWhatsApp() {
  $("wa").onclick = () => {
    const U = state.USER;
    let tot = 0;
    const L = ["¡Hola! Soy " + (U ? U.name : "cliente") + (U && U.phone ? " (" + U.phone + ")" : "") + ". Quiero realizar este pedido:", ""];
    state.cart.forEach((c, i) => {
      const p = pid(c.id);
      tot += p.price * c.qty;
      L.push((i + 1) + ". " + p.name + " (Ref. " + p.id + ")", "   Talla: " + c.size + " · Cant.: " + c.qty + " · " + money(p.price * c.qty));
      if (p.img.indexOf("data:") !== 0) L.push("   Imagen: " + new URL(p.img, location.href).href);
      L.push("");
    });
    L.push("*Total: " + money(tot) + "*");
    postEvent("order", { items: state.cart.reduce((a, c) => a + c.qty, 0), total: tot }).catch(() => {}); // queda en el historial del cliente
    window.open("https://wa.me/" + CFG.phone + "?text=" + encodeURIComponent(L.join("\n")), "_blank");
  };
}
