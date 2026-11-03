// Carga las variables del archivo .env (sin instalar nada extra).
// Formato:  CLAVE=valor   (una por línea; las líneas que empiezan con # se ignoran)
const fs = require("fs");
const path = require("path");

const archivo = path.join(__dirname, ".env");
if (fs.existsSync(archivo)) {
  for (const linea of fs.readFileSync(archivo, "utf8").split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let valor = m[2];
    if (/^(".*"|'.*')$/.test(valor)) valor = valor.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = valor;
  }
}
