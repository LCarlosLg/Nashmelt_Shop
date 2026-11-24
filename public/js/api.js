// Comunicación con el servidor. La sesión viaja sola en la cookie nm_sid (HttpOnly): el JS nunca la ve.
let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

// opts.auth = true → es una llamada de login/sesión: un 401 aquí NO significa "sesión vencida"
async function call(method, url, body, opts = {}) {
  const init = { method, headers: {}, credentials: "same-origin", keepalive: !!opts.keepalive };
  if (body instanceof Blob) { init.headers["Content-Type"] = body.type || "application/octet-stream"; init.body = body; }
  else if (body !== undefined) { init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(body); }

  let r;
  try { r = await fetch(url, init); }
  catch (e) { throw { code: 0, message: "No hay conexión con el servidor." }; }
  let data = null;
  try { data = await r.json(); } catch (e) { /* sin cuerpo */ }
  if (!r.ok) {
    if (r.status === 401 && !opts.auth) onUnauthorized();
    throw { code: r.status, message: (data && data.error) || "Error " + r.status };
  }
  return data;
}

/* ---------- Sesión ---------- */
export async function fetchMe() {                     // usuario de la cookie, o null si no hay sesión
  return (await call("GET", "/api/auth/me", undefined, { auth: true })).user;
}
export const login = (email, password) => call("POST", "/api/auth/login", { email, password }, { auth: true });
export const adminLogin = (username, password) => call("POST", "/api/auth/admin-login", { username, password }, { auth: true });
export const register = (data) => call("POST", "/api/auth/register", data, { auth: true });
export const logout = () => call("POST", "/api/auth/logout", undefined, { auth: true });

/* ---------- Datos del usuario (carrito, favoritos, actividad) ---------- */
export const fetchState = () => call("GET", "/api/me/state");
export const saveState = (cart, favs) => call("PUT", "/api/me/state", { cart, favs }, { keepalive: true });
export const postEvent = (type, detail) => call("POST", "/api/me/events", { type, detail });

/* ---------- Catálogo ---------- */
export const fetchProducts = () => call("GET", "/api/products");
export const saveProducts = (list) => call("PUT", "/api/products", list);

// Sube una foto al servidor; se guarda en public/img/ y devuelve su ruta (ej. "/img/prod-123.jpg")
export async function uploadImage(blob) {
  return (await call("POST", "/api/images", blob)).url;
}

/* ---------- Solo administrador ---------- */
export const fetchCustomers = () => call("GET", "/api/admin/customers");
