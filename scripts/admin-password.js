// Cambia la contraseña del administrador y cierra sus sesiones abiertas.
//   npm run admin:password -- "NuevaContraseñaSegura123"
const { db } = require("../src/db");
const { hashPassword } = require("../src/services/auth");

const pw = process.argv[2];
if (!pw || pw.length < 12) {
  console.error('Uso: npm run admin:password -- "NuevaContraseña"   (mínimo 12 caracteres)');
  process.exit(1);
}

hashPassword(pw).then((hash) => {
  const r = db.prepare("UPDATE users SET password_hash = ? WHERE role = 'admin'").run(hash);
  if (!r.changes) { console.error("Todavía no existe la cuenta de administrador: arranca el servidor una vez (npm start)."); process.exit(1); }
  db.prepare("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE role = 'admin')").run();
  console.log("Contraseña del administrador actualizada.");
});
