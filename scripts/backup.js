// Copia de seguridad de la base de datos y del catálogo.
//   npm run backup
// Crea data/backups/nashmelt-YYYYMMDD-HHMMSS.db y products-....json
const fs = require("fs");
const path = require("path");
const { DB_FILE, PRODUCTS_FILE } = require("../config");

const BACKUP_DIR = path.join(path.dirname(DB_FILE), "backups");
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);

fs.mkdirSync(BACKUP_DIR, { recursive: true });

function copy(src, name) {
  if (!fs.existsSync(src)) {
    console.warn("No existe:", src);
    return;
  }
  const dest = path.join(BACKUP_DIR, `${name}-${stamp}${path.extname(src)}`);
  fs.copyFileSync(src, dest);
  console.log("OK →", dest);
}

copy(DB_FILE, "nashmelt");
// También WAL/SHM si existen (SQLite en modo WAL)
const wal = DB_FILE + "-wal";
const shm = DB_FILE + "-shm";
if (fs.existsSync(wal)) copy(wal, "nashmelt-wal");
if (fs.existsSync(shm)) copy(shm, "nashmelt-shm");
copy(PRODUCTS_FILE, "products");

console.log("Respaldo terminado en", BACKUP_DIR);