// Autenticación: contraseñas (scrypt), sesiones con cookie, registro y login de clientes / administrador
const crypto = require("crypto");
const { promisify } = require("util");
const cfg = require("../../config");
const { q, logActivity } = require("../db");
const { sendJson, fail, readJson, parseCookies, setCookie } = require("../utils/http");
const { securityLog } = require("../utils/security-log");

const scrypt = promisify(crypto.scrypt);
const sha = (t) => crypto.createHash("sha256").update(t).digest("hex");

/* ---------- Contraseñas ---------- */
const N = 16384, R = 8, P = 1;

async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt, 64, { N, r: R, p: P });
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

async function verifyPassword(pw, stored) {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt") return false;
  const expected = Buffer.from(hash, "base64");
  const key = await scrypt(pw, Buffer.from(salt, "base64"), expected.length, { N: +n, r: +r, p: +p });
  return crypto.timingSafeEqual(key, expected);
}

// Para que "usuario inexistente" tarde lo mismo que "contraseña incorrecta"
let dummyHash;
async function fakeVerify(pw) {
  dummyHash = dummyHash || (await hashPassword("no-existe"));
  await verifyPassword(pw, dummyHash);
}

/* ---------- Límite de intentos (en memoria) ---------- */
function makeLimiter(max, lockMs) {
  const hits = new Map();
  return {
    locked(key) {
      const h = hits.get(key);
      return h && h.until > Date.now() ? Math.ceil((h.until - Date.now()) / 60000) : 0;
    },
    fail(key) {
      const h = hits.get(key) || { n: 0, until: 0 };
      if (h.until && h.until < Date.now()) { h.n = 0; h.until = 0; }
      if (++h.n >= max) {
        h.until = Date.now() + lockMs;
        h.n = 0;
        return true; // acaba de bloquear
      }
      hits.set(key, h);
      return false;
    },
    clear(key) { hits.delete(key); },
    prune() {
      const now = Date.now();
      hits.forEach((h, k) => { if (h.until < now && h.n === 0) hits.delete(k); });
    },
  };
}
const loginLimit = makeLimiter(5, 5 * 60e3);   // 5 fallos por equipo+usuario → bloqueo de 5 min
const regHits = new Map();                      // máx. 10 registros por hora por equipo

function clientIp(req) {
  if (cfg.TRUST_PROXY && req.headers["x-forwarded-for"]) return String(req.headers["x-forwarded-for"]).split(",")[0].trim();
  return req.socket.remoteAddress || "";
}
const isSecure = (req) => !!req.socket.encrypted || (cfg.TRUST_PROXY && req.headers["x-forwarded-proto"] === "https");

/* ---------- Sesiones (cookie nm_sid → fila en la tabla sessions) ---------- */
const publicUser = (u) => ({ id: u.id, role: u.role, name: u.name, email: u.email, phone: u.phone });

function createSession(req, res, user) {
  const old = parseCookies(req)[cfg.COOKIE_NAME];
  if (old) q.deleteSession.run(sha(old));
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now(), admin = user.role === "admin";
  const ttl = admin ? cfg.ADMIN_TTL : cfg.CUSTOMER_TTL;
  q.insertSession.run(sha(token), user.id, now, now, now + ttl, clientIp(req), String(req.headers["user-agent"] || "").slice(0, 200));
  setCookie(res, cfg.COOKIE_NAME, token, { maxAge: admin ? undefined : ttl, secure: isSecure(req) });
}

function getSession(req, res) {
  const token = parseCookies(req)[cfg.COOKIE_NAME];
  if (!token) return null;
  const id = sha(token), row = q.sessionWithUser.get(id);
  if (!row) return null;
  const now = Date.now(), admin = row.role === "admin";
  if (row.expires_at < now || (admin && now - row.s_seen > cfg.ADMIN_IDLE)) {
    q.deleteSession.run(id);
    return null;
  }
  if (admin) q.seenSession.run(now, id);
  else if (now - row.s_seen > 3600e3) {
    q.renewSession.run(now, now + cfg.CUSTOMER_TTL, id);
    setCookie(res, cfg.COOKIE_NAME, token, { maxAge: cfg.CUSTOMER_TTL, secure: isSecure(req) });
  }
  if (!row.u_seen || now - row.u_seen > 5 * 60e3) q.touchSeen.run(now, row.id);
  return publicUser(row);
}

/* ---------- Endpoints ---------- */
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

async function register(req, res) {
  const ip = clientIp(req), now = Date.now();
  const h = regHits.get(ip) && regHits.get(ip).reset > now ? regHits.get(ip) : { n: 0, reset: now + 3600e3 };
  if (h.n >= 10) {
    securityLog.warn("register_rate_limited", { ip });
    throw fail(429, "Demasiados registros desde este equipo. Intenta más tarde.");
  }

  const b = await readJson(req, cfg.MAX_BODY);
  const name = str(b.name, 80), email = str(b.email, 120).toLowerCase(), phone = str(b.phone, 30);
  const pw = typeof b.password === "string" ? b.password : "";
  if (name.length < 2) throw fail(400, "Escribe tu nombre.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail(400, "Escribe un correo válido.");
  if (!/^[0-9+()\-\s]*$/.test(phone)) throw fail(400, "El teléfono solo puede llevar números, espacios, + - ( ).");
  if (pw.length < 8 || pw.length > 200) throw fail(400, "La contraseña debe tener al menos 8 caracteres.");
  if (q.userByLogin.get(email, "customer")) throw fail(409, "Ese correo ya está registrado. Inicia sesión.");

  let id;
  try {
    id = Number(q.insertUser.run("customer", email, name, email, phone, await hashPassword(pw), now).lastInsertRowid);
  } catch (e) {
    throw fail(409, "Ese correo ya está registrado. Inicia sesión.");
  }
  h.n++;
  regHits.set(ip, h);
  q.touchLogin.run(now, now, id);
  const user = { id, role: "customer", name, email, phone };
  createSession(req, res, user);
  logActivity(id, "register");
  securityLog.info("register", { ip, login: email, role: "customer" });
  sendJson(res, 201, { user: publicUser(user) });
}

function loginHandler(role) {
  return async (req, res) => {
    const b = await readJson(req, cfg.MAX_BODY);
    const login = str(role === "admin" ? b.username : b.email, 120).toLowerCase();
    const pw = typeof b.password === "string" ? b.password : "";
    const ip = clientIp(req);
    const key = role + "|" + ip + "|" + login;
    const wait = loginLimit.locked(key);
    if (wait) {
      securityLog.warn("login_blocked", { ip, login, role, reason: "rate_limit", waitMin: wait });
      throw fail(429, "Demasiados intentos. Intenta de nuevo en " + wait + " min.");
    }

    const user = q.userByLogin.get(login, role);
    let ok = false;
    if (user) ok = await verifyPassword(pw, user.password_hash);
    else await fakeVerify(pw);

    if (!ok) {
      const justLocked = loginLimit.fail(key);
      securityLog.warn("login_failed", {
        ip,
        login,
        role,
        reason: user ? "bad_password" : "unknown_user",
        locked: !!justLocked,
      });
      throw fail(401, role === "admin" ? "Usuario o contraseña incorrectos." : "Correo o contraseña incorrectos.");
    }

    loginLimit.clear(key);
    const now = Date.now();
    q.touchLogin.run(now, now, user.id);
    createSession(req, res, user);
    logActivity(user.id, "login");
    securityLog.info("login_ok", { ip, login, role, userId: user.id });
    sendJson(res, 200, { user: publicUser(user) });
  };
}

function logout(req, res, ctx) {
  const token = parseCookies(req)[cfg.COOKIE_NAME];
  if (token) q.deleteSession.run(sha(token));
  if (ctx.user) {
    logActivity(ctx.user.id, "logout");
    securityLog.info("logout", { userId: ctx.user.id, role: ctx.user.role });
  }
  setCookie(res, cfg.COOKIE_NAME, "", { maxAge: 0, secure: isSecure(req) });
  sendJson(res, 200, { ok: true });
}

function me(req, res, ctx) {
  sendJson(res, 200, { user: ctx.user });
}

/* ---------- Arranque ---------- */
async function init() {
  if (!q.adminExists.get()) {
    if (!process.env.ADMIN_PASSWORD && cfg.ADMIN_PASSWORD === "CambiaEstaClaveYA!") {
      console.warn(" Admin creado con contraseña por defecto. Cámbiala YA:");
      console.warn('   npm run admin:password -- "TuContraseñaLargaYSegura"');
    }
    q.insertUser.run("admin", cfg.ADMIN_USER, "Administrador", null, "", await hashPassword(cfg.ADMIN_PASSWORD), Date.now());
    console.log(`Cuenta de administrador creada (usuario: ${cfg.ADMIN_USER}).`);
    securityLog.info("admin_created", { login: cfg.ADMIN_USER });
  }
  setInterval(() => {
    q.deleteExpired.run(Date.now());
    loginLimit.prune();
  }, 30 * 60e3).unref();
}

module.exports = {
  init, hashPassword, getSession, me, logout, register,
  login: loginHandler("customer"),
  adminLogin: loginHandler("admin"),
};