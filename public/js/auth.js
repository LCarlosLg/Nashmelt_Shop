// Pantallas de acceso: clientes (login / registro) y administrador. Todo se valida en el servidor;
// aquí solo se envían los formularios y se muestran los errores. La sesión vive en una cookie HttpOnly.
import { state } from "./state.js";
import { AD_IDLE } from "./config.js";
import { $, toast, closeAll } from "./utils.js";
import { login, adminLogin, register, logout as apiLogout, fetchMe } from "./api.js";
import { flush } from "./cart.js";

// main.js se encarga de recargar datos y pantalla cuando cambia la sesión
let onSession = async () => {};
export function setSessionHook(fn) { onSession = fn; }

export const isAdminRoute = () => location.hash === "#admin";
const isAdmin = () => !!state.USER && state.USER.role === "admin";

// Muestra u oculta login, botón "Salir" y "Regresar al panel" según la sesión
export function ui() {
  const U = state.USER, adm = isAdmin();
  $("login").hidden = !!U || isAdminRoute();
  $("out").hidden = !U || adm;
  $("back").hidden = !(adm && !isAdminRoute());
  $("out").textContent = U && !adm ? "Salir (" + U.name.split(" ")[0] + ")" : "";
}

// Envía un formulario: bloquea el botón, muestra el error del servidor y, si sale bien, recarga la sesión
async function attempt(btnId, errId, fn) {
  const btn = $(btnId), err = $(errId);
  err.textContent = "";
  btn.disabled = true;
  try { await fn(); await onSession(); return true; }
  catch (x) { err.textContent = x.message || "No se pudo completar la acción."; return false; }
  finally { btn.disabled = false; }
}

/* ---------- Clientes ---------- */
async function signin() {
  if (await attempt("lgo", "lerr", () => login($("le").value.trim(), $("lw").value))) $("lw").value = "";
}

async function signup() {
  const n = $("rn").value.trim(), em = $("re").value.trim(), pw = $("rw").value, e = $("lerr");
  if (n.length < 2) { e.textContent = "Escribe tu nombre."; return; }
  if (!/^\S+@\S+\.\S+$/.test(em)) { e.textContent = "Escribe un correo válido."; return; }
  if (pw.length < 8) { e.textContent = "La contraseña debe tener al menos 8 caracteres."; return; }
  if (pw !== $("rw2").value) { e.textContent = "Las contraseñas no coinciden."; return; }
  if (!$("rpv").checked) { e.textContent = "Para crear tu cuenta debes aceptar el Aviso de Privacidad."; return; }
  if (await attempt("rgo", "lerr", () => register({ name: n, email: em, phone: $("rp").value.trim(), password: pw }))) {
    $("rw").value = ""; $("rw2").value = ""; $("rpv").checked = false;
  }
}

/* ---------- Administrador ---------- */
async function admIn() {
  if (await attempt("ago", "gmsg", () => adminLogin($("au").value.trim(), $("aw").value))) $("aw").value = "";
}

// Cierra la sesión (guarda antes el carrito pendiente)
async function logout() {
  await flush();
  try { await apiLogout(); } catch (e) { /* la sesión caduca sola en el servidor */ }
  await onSession();
}

export async function admOut(idle) {
  if (state.dirty && !idle) { toast("Publica tus cambios antes de salir"); return; }
  state.dirty = false;
  await logout();
  if (idle) toast("Sesión de administrador cerrada por inactividad");
}

export function initAuth() {
  document.querySelectorAll("[data-lt]").forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll("[data-lt]").forEach((x) => x.classList.toggle("on", x === b));
      $("li").hidden = b.dataset.lt !== "in";
      $("lu").hidden = b.dataset.lt !== "up";
      $("lerr").textContent = "";
    };
  });
  $("lgo").onclick = signin;
  $("rgo").onclick = signup;
  $("ago").onclick = admIn;
  $("back").onclick = () => { location.hash = "#admin"; };
  $("out").onclick = async () => { closeAll(); await logout(); };
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const i = e.target.id;
    if (i === "le" || i === "lw") signin();
    else if (/^r[nepw]/.test(i)) signup();
    else if (i === "au" || i === "aw") admIn();
  });

  // Inactividad del admin: mientras haya actividad se avisa al servidor (cada 4 min) para no perder la sesión
  let lastAct = Date.now(), lastPing = Date.now();
  const touch = () => {
    if (!isAdmin()) return;
    lastAct = Date.now();
    if (lastAct - lastPing > 4 * 60e3) {
      lastPing = lastAct;
      fetchMe().then((u) => { if (!u) { toast("Sesión de administrador cerrada por inactividad"); onSession(); } }).catch(() => {});
    }
  };
  ["click", "keydown", "touchstart"].forEach((t) => addEventListener(t, touch, { passive: true }));
  setInterval(() => { if (isAdmin() && Date.now() - lastAct > AD_IDLE) admOut(true); }, 60e3);
}