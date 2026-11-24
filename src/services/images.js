// Fotos de productos: subida a public/img/ y limpieza de fotos que ya no se usan
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { IMG_DIR, MAX_IMAGE, UPLOAD_PREFIX, ORPHAN_MAX_AGE } = require("../../config");
const { sendJson, readBuffer, fail } = require("../utils/http");
const { securityLog } = require("../utils/security-log");

function detectExt(b) {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return ".jpg";
  if (b.length > 12 && b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ".png";
  if (b.length > 12 && b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP") return ".webp";
  return null;
}

// POST /api/images  (solo admin; cuerpo = bytes de la imagen) → { url: "/img/prod-....jpg" }
async function upload(req, res, ctx) {
  const buf = await readBuffer(req, MAX_IMAGE);
  const ext = detectExt(buf);
  if (!ext) throw fail(415, "Formato no permitido (usa JPG, PNG o WebP)");
  const name = UPLOAD_PREFIX + Date.now() + "-" + crypto.randomBytes(4).toString("hex") + ext;
  fs.mkdirSync(IMG_DIR, { recursive: true });
  fs.writeFileSync(path.join(IMG_DIR, name), buf);
  securityLog.info("image_upload", {
    userId: ctx.user && ctx.user.id,
    file: name,
    bytes: buf.length,
  });
  sendJson(res, 201, { url: "/img/" + name });
}

// Borra las fotos subidas que ningún producto usa (ni como foto principal ni como foto adicional)
function removeOrphans(products) {
  try {
    const used = new Set();
    products.forEach((p) => {
      [p.img].concat(Array.isArray(p.imgs) ? p.imgs : []).forEach((u) => {
        if (typeof u === "string" && u.startsWith("/img/")) used.add(u.slice(5));
      });
    });
    fs.readdirSync(IMG_DIR).forEach((f) => {
      if (!f.startsWith(UPLOAD_PREFIX) || used.has(f)) return;
      const file = path.join(IMG_DIR, f);
      if (Date.now() - fs.statSync(file).mtimeMs > ORPHAN_MAX_AGE) fs.unlinkSync(file);
    });
  } catch (e) { /* la limpieza nunca debe romper el guardado */ }
}

module.exports = { upload, removeOrphans };