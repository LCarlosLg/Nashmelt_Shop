// Punto de entrada: comprueba Node, prepara la base de datos y arranca el servidor
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`Nashmelt necesita Node.js 22.13 o superior (tienes ${process.versions.node}). Descárgalo en https://nodejs.org`);
  process.exit(1);
}

const { PORT, HOST } = require("./config");
const auth = require("./src/services/auth");
const createApp = require("./src/app");

auth.init().then(() => {
  createApp().listen(PORT, HOST, () => {
    console.log(`Nashmelt → http://localhost:${PORT}`);
    console.log(`Panel admin → http://localhost:${PORT}/#admin`);
  });
});
