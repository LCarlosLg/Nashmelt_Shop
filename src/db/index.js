// Base de datos SQLite (módulo node:sqlite incluido en Node 22.13+).
// Archivo: data/nashmelt.db  ·  Tablas: users, sessions, user_state, activity
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { DB_FILE } = require("../../config");

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
const db = new DatabaseSync(DB_FILE);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  role          TEXT    NOT NULL CHECK (role IN ('admin','customer')),
  login         TEXT    NOT NULL UNIQUE,      -- correo (cliente) o usuario (admin), en minúsculas
  name          TEXT    NOT NULL,
  email         TEXT,
  phone         TEXT    NOT NULL DEFAULT '',
  password_hash TEXT    NOT NULL,             -- scrypt: nunca se guarda la contraseña
  created_at    INTEGER NOT NULL,
  last_login_at INTEGER,
  last_seen_at  INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (         -- una fila por navegador con sesión iniciada (cookie)
  id           TEXT    PRIMARY KEY,           -- SHA-256 del token de la cookie
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  ip           TEXT,
  user_agent   TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS user_state (       -- carrito y favoritos de cada usuario
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  cart       TEXT    NOT NULL DEFAULT '[]',
  favs       TEXT    NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS activity (         -- historial: register, login, logout, order
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  type       TEXT    NOT NULL,
  detail     TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity(user_id, created_at);
`);

// Consultas preparadas
const q = {
  userByLogin: db.prepare("SELECT * FROM users WHERE login = ? AND role = ?"),
  insertUser: db.prepare("INSERT INTO users (role, login, name, email, phone, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"),
  touchLogin: db.prepare("UPDATE users SET last_login_at = ?, last_seen_at = ? WHERE id = ?"),
  touchSeen: db.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?"),
  adminExists: db.prepare("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1"),

  insertSession: db.prepare("INSERT INTO sessions (id, user_id, created_at, last_seen_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)"),
  sessionWithUser: db.prepare(`SELECT s.id AS sid, s.last_seen_at AS s_seen, s.expires_at, u.id, u.role, u.name, u.email, u.phone, u.last_seen_at AS u_seen
                               FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`),
  renewSession: db.prepare("UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?"),
  seenSession: db.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?"),
  deleteSession: db.prepare("DELETE FROM sessions WHERE id = ?"),
  deleteExpired: db.prepare("DELETE FROM sessions WHERE expires_at < ?"),

  getState: db.prepare("SELECT cart, favs FROM user_state WHERE user_id = ?"),
  saveState: db.prepare(`INSERT INTO user_state (user_id, cart, favs, updated_at) VALUES (?, ?, ?, ?)
                         ON CONFLICT(user_id) DO UPDATE SET cart = excluded.cart, favs = excluded.favs, updated_at = excluded.updated_at`),

  log: db.prepare("INSERT INTO activity (user_id, type, detail, created_at) VALUES (?, ?, ?, ?)"),
  customers: db.prepare(`SELECT u.id, u.name, u.email, u.phone, u.created_at, u.last_login_at, u.last_seen_at,
                                (SELECT COUNT(*) FROM activity a WHERE a.user_id = u.id AND a.type = 'order') AS orders
                         FROM users u WHERE u.role = 'customer' ORDER BY u.created_at DESC`),
};

function logActivity(userId, type, detail) {
  q.log.run(userId, type, detail ? JSON.stringify(detail) : null, Date.now());
}

module.exports = { db, q, logActivity };
