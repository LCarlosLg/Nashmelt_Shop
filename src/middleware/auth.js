const authService = require("../services/auth");
const { fail } = require("../utils/http");

function getSession(req, res) {
  return authService.getSession(req, res);
}

function requireUser(ctx) {
  if (!ctx.user) throw fail(401, "Inicia sesión para continuar.");
}

function requireAdmin(ctx) {
  requireUser(ctx);
  if (ctx.user.role !== "admin") {
    throw fail(403, "Solo el administrador puede hacer esto.");
  }
}

module.exports = { getSession, requireUser, requireAdmin };