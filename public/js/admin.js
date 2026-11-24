import { state, art, units, pid, nid } from "./state.js";
import { CATS, COLORS, SIZES } from "./config.js";
import { $, esc, money, toast } from "./utils.js";
import { saveProducts, uploadImage, fetchCustomers } from "./api.js";
import { admOut } from "./auth.js";

const mark = () => { state.dirty = true; };

// Iconos de línea (SVG) del panel
const IC = {
  img: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-8 8"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6A17 17 0 0 0 2 12s3.6 7 10 7c1.7 0 3.2-.4 4.5-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v5M14 11v5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};
const ic = (d) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + "</svg>";

/* ---------- Publicar: guarda productos e inventario en el servidor ---------- */
async function pub() {
  try {
    const out = state.P.map((p) => {
      const o = Object.assign({}, p);
      if ((o.img || "").indexOf("data:image/svg") === 0) o.img = ""; // los placeholders se regeneran al cargar
      return o;
    });
    const b = $("apub"); if (b) b.textContent = "Publicando…";
    await saveProducts(out);
    state.dirty = false;
    toast("Cambios publicados ✓");
    admR();
  } catch (e) {
    if (e.code === 401) return;   // sesión vencida: main.js ya avisó y volvió al login
    const b2 = $("apub"); if (b2) b2.textContent = "Publicar cambios";
    toast("No se pudo publicar (" + ((e && e.code) || "error") + "). ¿Está corriendo el servidor?");
  }
}

/* ---------- Confirmación al eliminar ---------- */
// Ventana "¿Estás seguro…?" con No / Sí. Devuelve una promesa: true si el admin confirma.
function confirmDelete(name) {
  return new Promise((resolve) => {
    const prev = document.activeElement, w = document.createElement("div");
    w.className = "cdlg";
    w.innerHTML = '<div class="cbox" role="alertdialog" aria-modal="true" aria-labelledby="ctt"><div class="cico">' + ic(IC.trash) +
      '</div><h3 id="ctt">¿Estás seguro que deseas eliminar este producto?</h3><p>' + esc(name) +
      '</p><div class="cbt"><button class="cno" type="button">No</button><button class="cyes" type="button">Sí, eliminar</button></div></div>';
    document.body.appendChild(w);
    const no = w.querySelector(".cno"), yes = w.querySelector(".cyes");
    const done = (v) => {
      document.removeEventListener("keydown", onKey, true);
      w.remove();
      if (prev && prev.focus) prev.focus();
      resolve(v);
    };
    const onKey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); done(false); }
      else if (e.key === "Tab") { e.preventDefault(); (document.activeElement === no ? yes : no).focus(); }   // el foco no sale de la ventana
    };
    w.onclick = (e) => {
      if (e.target === w || e.target.closest(".cno")) done(false);      // clic fuera o en "No"
      else if (e.target.closest(".cyes")) done(true);
    };
    document.addEventListener("keydown", onKey, true);
    no.focus();   // por seguridad, "No" queda seleccionado
  });
}

/* ---------- Vistas ---------- */
function rowsH() {
  const q = state.AE.q.toLowerCase();
  return state.P.filter((p) => !q || (p.name + " " + p.cat).toLowerCase().indexOf(q) > -1).map((p) => {
    const t = units(p), oculto = p.active === false;
    return '<div class="ar"><img alt="" src="' + esc(p.img) + '"><div class="nmx"><b>' + esc(p.name) + "</b><small>" + p.cat + " · " + money(p.price) +
      " · " + (t ? t + " uds" : "Agotado") + (oculto ? " · oculto" : "") + '</small></div><div class="stk">' +
      p.sizes.map((s) => "<label>" + s + '<input type="number" min="0" value="' + (p.stock[s] || 0) + '" data-st="' + p.id + "|" + s + '"></label>').join("") +
      '</div><div class="acts">' +
      '<label class="pbtn" title="Cambiar la foto">' + ic(IC.img) + "<span>Editar foto</span>" + '<input type="file" accept="image/*" data-pf="' + p.id + '" hidden></label>' +
      '<button data-tg="' + p.id + '" title="' + (oculto ? "Mostrar en el catálogo" : "Ocultar del catálogo") + '">' + ic(oculto ? IC.eye : IC.eyeOff) + "<span>" + (oculto ? "Mostrar" : "Ocultar") + "</span></button>" +
      '<button data-ed="' + p.id + '" title="Editar datos">' + ic(IC.edit) + "<span>Editar</span></button>" +
      '<button class="dng" data-dl="' + p.id + '" title="Eliminar prenda">' + ic(IC.trash) + "<span>Eliminar</span></button>" +
      "</div></div>";
  }).join("") || '<div class="empty">Sin productos</div>';
}

// Fecha legible, o "—" si no hay
const fmtDate = (t) => (t ? new Date(t).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "—");

// Clientes registrados (solo lectura): contacto, fechas y pedidos enviados por WhatsApp
function customersH() {
  const L = state.AE.customers;
  if (!L) return '<div class="empty">Cargando clientes…</div>';
  if (!L.length) return '<div class="empty">Todavía no hay clientes registrados.</div>';
  return L.map((c) => '<div class="ar cu"><div class="nmx"><b>' + esc(c.name) + "</b><small>" + esc(c.email) + (c.phone ? " · " + esc(c.phone) : "") +
    "</small></div><small>Registro: " + fmtDate(c.createdAt) + " · Última visita: " + fmtDate(c.lastSeenAt) + " · Pedidos enviados: " + c.orders + "</small></div>").join("");
}

async function loadCustomers() {
  state.AE.customers = null;
  admR();
  try { state.AE.customers = await fetchCustomers(); admR(); }
  catch (e) { if (e.code !== 401) toast(e.message); }
}

function formH() {
  const AE = state.AE;
  const f = AE.f || (AE.f = { name: "", cat: CATS[0], color: COLORS[0][0], price: "", old: "", desc: "", img: "", active: true, sizes: ["S", "M", "L"], stock: {} });
  return '<div class="fm"><label>Nombre del producto<input id="fn" value="' + esc(f.name) + '"></label>' +
    '<div class="r2"><label>Categoría<select id="fcat">' + CATS.map((c) => "<option" + (c === f.cat ? " selected" : "") + ">" + c + "</option>").join("") +
    '</select></label><label>Color<select id="fcol">' + COLORS.map((c) => "<option" + (c[0] === f.color ? " selected" : "") + ">" + c[0] + "</option>").join("") + "</select></label></div>" +
    '<div class="r2"><label>Precio<input id="fpr" type="number" min="0" step="any" value="' + f.price + '"></label><label>Precio anterior (opcional)<input id="fold" type="number" min="0" step="any" value="' + (f.old || "") + '"></label></div>' +
    '<label>Descripción<textarea id="fds" rows="3">' + esc(f.desc || "") + "</textarea></label>" +
    '<div><b>Tallas e inventario</b><div class="szs">' +
    SIZES.map((s) => '<label class="sz"><input type="checkbox" data-fz="' + s + '"' + (f.sizes.indexOf(s) > -1 ? " checked" : "") + "> " + s +
      '<input type="number" min="0" placeholder="0" data-fq="' + s + '" value="' + (f.stock[s] || "") + '"></label>').join("") + "</div></div>" +
    '<div><b>Imagen</b><div class="up">' + (f.img ? '<img alt="" src="' + esc(f.img) + '">' : "") +
    '<input type="file" accept="image/*" id="ffile"><input id="furl" placeholder="o escribe la ruta/URL (ej. /img/foto.jpg)" value="' + esc((f.img || "").indexOf("data:") === 0 ? "" : f.img || "") + '">' +
    (f.img ? '<button class="reset" id="fimg0" type="button">Quitar imagen</button>' : "") + "</div></div>" +
    '<label class="ck"><input type="checkbox" id="fact"' + (f.active !== false ? " checked" : "") + "> Visible en el catálogo</label>" +
    '<button class="wa" id="fsave">' + (f.id ? "Guardar cambios" : "Agregar producto") + "</button>" +
    (f.id ? "" : '<button class="reset" id="fmore">Guardar y agregar otra</button>') +
    '<button class="reset" id="fcan">Cancelar</button><p class="err" id="ferr"></p></div>';
}

export function admR() {
  const AE = state.AE, { P, dirty } = state, sc = $("admin").scrollTop;
  let u = 0, val = 0, low = 0, out = 0;
  P.forEach((p) => { const t = units(p); u += t; val += t * p.price; if (!t) out++; else if (t <= 5) low++; });
  $("admin").innerHTML =
    '<div class="ah"><b>Panel de administración</b><span style="display:flex;gap:8px"><button class="chip' + (dirty ? " on" : "") + '" id="apub">' +
    (dirty ? "Publicar cambios" : "Sin cambios") + '</button><button class="chip" id="acl">Ver tienda</button><button class="chip" id="aout">Salir</button></span></div><div class="ab">' +
    '<div class="kp"><div><b>' + P.length + "</b>Productos</div><div><b>" + u + "</b>Unidades</div><div><b>" + low + "</b>Stock bajo (≤5)</div><div><b>" + out +
    "</b>Agotados</div><div><b>" + money(val) + "</b>Valor del inventario</div></div>" +
    '<div class="tabs"><button class="chip' + (AE.tab === "inv" ? " on" : "") + '" data-at="inv">Inventario</button><button class="chip' + (AE.tab === "new" ? " on" : "") +
    '" data-at="new">' + (AE.f && AE.f.id ? "Editar prenda" : "Nueva prenda") + '</button><button class="chip' + (AE.tab === "cus" ? " on" : "") +
    '" data-at="cus">Clientes' + (AE.customers ? " (" + AE.customers.length + ")" : "") + "</button></div>" +
    (AE.tab === "inv"
      ? '<div class="tb"><input class="asq" id="asq" type="search" placeholder="Buscar en el inventario…" value="' + esc(AE.q) +
        '"><button class="addb" id="addn">' + ic(IC.plus) + "<span>Agregar prenda nueva</span></button></div>" +
        '<div id="atb">' + rowsH() + "</div>"
      : AE.tab === "cus" ? customersH() : formH()) + "</div>";
  $("admin").scrollTop = sc;
}

/* ---------- Formulario de producto ---------- */
function readF() {
  const f = state.AE.f;
  if (!f || !$("fn")) return f;
  f.name = $("fn").value.trim(); f.cat = $("fcat").value; f.color = $("fcol").value;
  f.price = $("fpr").value; f.old = $("fold").value; f.desc = $("fds").value.trim(); f.active = $("fact").checked;
  f.sizes = []; f.stock = {};
  document.querySelectorAll("[data-fz]").forEach((c) => {
    if (c.checked) {
      const s = c.dataset.fz;
      f.sizes.push(s);
      f.stock[s] = Math.max(0, parseInt(document.querySelector('[data-fq="' + s + '"]').value) || 0);
    }
  });
  return f;
}

function saveF(more) {
  const f = readF(), e = $("ferr"), pr = parseFloat(f.price), o = parseFloat(f.old) || 0;
  if (f.name.length < 2) { e.textContent = "Escribe el nombre del producto."; return; }
  if (!(pr > 0)) { e.textContent = "Escribe un precio válido."; return; }
  if (o && o <= pr) { e.textContent = "El precio anterior debe ser mayor que el precio actual."; return; }
  if (!f.sizes.length) { e.textContent = "Selecciona al menos una talla."; return; }
  const hex = COLORS.filter((c) => c[0] === f.color)[0][1];
  const rec = {
    id: f.id || nid(), name: f.name, cat: f.cat, color: f.color, hex, price: pr, old: o, desc: f.desc, img: f.img || "",
    active: f.active, sizes: f.sizes, stock: f.stock, rate: f.rate || "4.8", sold: f.sold || 0, added: f.id ? f.added : Date.now(),
  };
  if (!rec.img) rec.img = art(rec.cat, rec.hex, rec.id);
  const i = state.P.findIndex((p) => p.id === rec.id);
  if (i > -1) state.P[i] = rec; else state.P.unshift(rec);
  mark(); state.AE.f = null; state.AE.tab = more ? "new" : "inv"; admR();
  if (more) toast("Prenda guardada ✓ Pulsa Publicar cambios al terminar");
  else { toast("Publicando en la tienda…"); pub(); }
}

/* ---------- Eventos del panel ---------- */
export function initAdmin() {
  const adm = $("admin");

  adm.onclick = (e) => {
    const t = e.target, d = t.dataset || {}, AE = state.AE;
    if (t.id === "acl") location.hash = "";
    else if (t.id === "aout") admOut();
    else if (t.id === "apub") { if (state.dirty) pub(); }
    else if (d.at) { if (AE.tab === "new") readF(); AE.tab = d.at; admR(); if (d.at === "cus") loadCustomers(); }
    else if (d.ed) { AE.f = JSON.parse(JSON.stringify(pid(+d.ed))); AE.tab = "new"; admR(); }
    else if (d.tg) { const p = pid(+d.tg); p.active = p.active === false; mark(); admR(); }
    else if (d.dl) {
      const id = +d.dl, p = pid(id);
      confirmDelete(p ? p.name : "").then((ok) => {
        if (!ok) return;
        state.P = state.P.filter((x) => x.id !== id);
        mark(); admR();
        toast("Producto eliminado. Pulsa Publicar cambios para guardarlo");
      });
    }
    else if (t.id === "addn") { AE.f = null; AE.tab = "new"; admR(); }
    else if (t.id === "fimg0") { readF(); AE.f.img = ""; admR(); }
    else if (t.id === "fsave") saveF();
    else if (t.id === "fmore") saveF(true);
    else if (t.id === "fcan") { AE.f = null; AE.tab = "inv"; admR(); }
  };

  adm.oninput = (e) => {
    if (e.target.id === "asq") { state.AE.q = e.target.value; $("atb").innerHTML = rowsH(); }
  };

  adm.onchange = async (e) => {
    const t = e.target, AE = state.AE;
    if (t.dataset.st) {
      const a = t.dataset.st.split("|"), p = pid(+a[0]);
      p.stock[a[1]] = Math.max(0, parseInt(t.value) || 0);
      mark(); admR();
    } else if (t.id === "ffile" && t.files[0]) {
      try { readF(); $("ferr").textContent = "Subiendo imagen…"; AE.f.img = await imgFrom(t.files[0]); admR(); }
      catch (x) { $("ferr").textContent = "No se pudo subir esa imagen. Prueba con una foto JPG o PNG."; }
    } else if (t.dataset.pf && t.files[0]) {
      const q = pid(+t.dataset.pf);
      toast("Subiendo imagen…");
      try { q.img = await imgFrom(t.files[0]); mark(); admR(); toast("Imagen actualizada, publicando…"); pub(); }
      catch (x) { toast("No se pudo subir esa imagen. Prueba con JPG o PNG"); }
    } else if (t.id === "furl") {
      const u = t.value.trim();
      if (!u) return;
      readF();
      $("ferr").textContent = "Comprobando URL…";
      const im = new Image();
      im.onload = () => { AE.f.img = u; admR(); };
      im.onerror = () => { $("ferr").textContent = "No se encontró esa imagen. Revisa la ruta (ej. /img/foto.jpg) o súbela como archivo."; };
      im.src = u;
    }
  };
}

// ---------- Imágenes ----------
// Las fotos se reducen a 900 px (JPEG) y se suben a public/img/ en el servidor.
function shrink(file, max) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement("canvas");
        c.width = Math.round(im.width * k);
        c.height = Math.round(im.height * k);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        c.toBlob((b) => (b ? res(b) : rej()), "image/jpeg", 0.82);
      };
      im.onerror = rej;
      im.src = fr.result;
    };
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

// Reduce la foto, la sube al servidor y devuelve su ruta en /img
async function imgFrom(file) {
  return uploadImage(await shrink(file, 900));
}