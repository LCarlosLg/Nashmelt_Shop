// Utilidades HTTP: respuestas, cookies y lectura del cuerpo de la petición
// Las cabeceras de seguridad (CSP, X-Frame-Options, etc.) se aplican en app.js con securityHeaders()

function send(res, code, body, type = "text/plain; charset=utf-8", cache = "no-store") {
  res.writeHead(code, {
    "Content-Type": type,
    "Cache-Control": cache,
  });
  res.end(body);
}

function sendJson(res, code, data) {
  send(res, code, JSON.stringify(data), "application/json; charset=utf-8");
}

// Error con código HTTP (los controladores lo lanzan y app.js responde)
function fail(status, message) {
  return Object.assign(new Error(message), { status });
}

function readBuffer(req, max) {
  return new Promise((resolve, reject) => {
    let size = 0, tooBig = false;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > max) tooBig = true;   // se sigue leyendo (sin guardar) para poder responder 413
      else chunks.push(c);
    });
    req.on("end", () => (tooBig ? reject(fail(413, "Archivo demasiado grande")) : resolve(Buffer.concat(chunks))));
    req.on("error", reject);
  });
}

async function readJson(req, max) {
  const buf = await readBuffer(req, max);
  try { return JSON.parse(buf.toString("utf8")); }
  catch (e) { throw fail(400, "JSON inválido"); }
}

/* ---------- Cookies ---------- */
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

// opts: { maxAge (ms), secure }. HttpOnly + SameSite=Lax siempre.
function setCookie(res, name, value, opts = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax`;
  if (opts.maxAge !== undefined) c += `; Max-Age=${Math.floor(opts.maxAge / 1000)}`;
  if (opts.secure) c += "; Secure";
  res.setHeader("Set-Cookie", c);
}

module.exports = { send, sendJson, fail, readBuffer, readJson, parseCookies, setCookie };