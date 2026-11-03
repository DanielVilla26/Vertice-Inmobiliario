const initSqlJs = require("sql.js");
const fs   = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const DB_PATH = path.join(__dirname, "data.sqlite");
let db;

async function init() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }

  // ── Usuarios ────────────────────────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre    TEXT NOT NULL,
    email     TEXT UNIQUE NOT NULL,
    password  TEXT NOT NULL,
    rol       TEXT NOT NULL DEFAULT 'usuario',
    avatar    TEXT DEFAULT '',
    telefono  TEXT DEFAULT '',
    bio       TEXT DEFAULT '',
    creado_en TEXT DEFAULT (datetime('now'))
  )`);
  migrateCol("usuarios", "avatar",   "TEXT DEFAULT ''");
  migrateCol("usuarios", "telefono", "TEXT DEFAULT ''");
  migrateCol("usuarios", "bio",      "TEXT DEFAULT ''");

  // ── Propiedades ─────────────────────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS propiedades (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo       TEXT NOT NULL,
    ciudad       TEXT NOT NULL,
    precio       INTEGER NOT NULL,
    imagen       TEXT,
    contacto     TEXT,
    descripcion  TEXT,
    tipo         TEXT DEFAULT 'apartamento',
    habitaciones INTEGER DEFAULT 1,
    banos        INTEGER DEFAULT 1,
    metros       INTEGER DEFAULT 0,
    direccion    TEXT DEFAULT '',
    activa       INTEGER DEFAULT 1,
    creado_en    TEXT DEFAULT (datetime('now'))
  )`);
  migrateCol("propiedades", "tipo",         "TEXT DEFAULT 'apartamento'");
  migrateCol("propiedades", "habitaciones", "INTEGER DEFAULT 1");
  migrateCol("propiedades", "banos",        "INTEGER DEFAULT 1");
  migrateCol("propiedades", "metros",       "INTEGER DEFAULT 0");
  migrateCol("propiedades", "direccion",    "TEXT DEFAULT ''");
  migrateCol("propiedades", "latitud",      "REAL");
  migrateCol("propiedades", "longitud",     "REAL");
  // Restricciones de la propiedad (max_personas: NULL o 0 = sin límite)
  migrateCol("propiedades", "max_personas", "INTEGER");
  migrateCol("propiedades", "mascotas",     "INTEGER DEFAULT 1");
  migrateCol("propiedades", "fumar",        "INTEGER DEFAULT 1");
  migrateCol("propiedades", "fiestas",      "INTEGER DEFAULT 1");

  // ── Imágenes ─────────────────────────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS imagenes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    propiedad_id INTEGER NOT NULL,
    url          TEXT NOT NULL,
    orden        INTEGER DEFAULT 0,
    FOREIGN KEY (propiedad_id) REFERENCES propiedades(id)
  )`);

  // ── Favoritos ─────────────────────────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS favoritos (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id   INTEGER NOT NULL,
    propiedad_id INTEGER NOT NULL,
    creado_en    TEXT DEFAULT (datetime('now')),
    UNIQUE(usuario_id, propiedad_id)
  )`);

  // ── Reservas ──────────────────────────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS reservas (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id    INTEGER NOT NULL,
    propiedad_id  INTEGER NOT NULL,
    fecha         TEXT NOT NULL,
    hora          TEXT NOT NULL,
    estado        TEXT DEFAULT 'pendiente',
    nota          TEXT,
    creado_en     TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (usuario_id)   REFERENCES usuarios(id),
    FOREIGN KEY (propiedad_id) REFERENCES propiedades(id)
  )`);

  // ── Seeds ─────────────────────────────────────────────────────────────────────
  const admin = db.exec("SELECT id FROM usuarios WHERE rol='admin' LIMIT 1");
  if (!admin.length || !admin[0].values.length) {
    const hash = bcrypt.hashSync("admin123", 10);
    db.run("INSERT INTO usuarios (nombre,email,password,rol) VALUES (?,?,?,?)",
      ["Administrador", "admin@verticeinmobiliario.com", hash, "admin"]);
  }

  // Cambio de marca: el admin de la versión anterior pasa al nuevo correo
  db.run("UPDATE usuarios SET email=? WHERE email='admin@casafacil.com' AND rol='admin'",
    ["admin@verticeinmobiliario.com"]);

  // ── Catálogo inicial de propiedades ───────────────────────────────────────────
  // reemplaza: título de la propiedad de ejemplo antigua que se actualiza en su lugar
  //            (conserva su id, favoritos, reservas y reseñas).
  // Las propiedades nuevas se crean solo si la base está vacía o se está actualizando la antigua.
  // Teléfonos con formato 555 (de muestra): cámbialos por los reales desde el panel de admin.
  const catalogo = [
    { reemplaza: "Apartamento moderno en Bogotá",
      titulo: "Apartamento remodelado en Chapinero Alto", ciudad: "Bogotá", precio: 2450000,
      imagen: "/img/propiedades/p1.svg", contacto: "+57 300 555 0101", tipo: "apartamento",
      hab: 2, banos: 2, metros: 68, direccion: "Carrera 4 #58-24, Chapinero Alto", lat: 4.6420, lng: -74.0610,
      max: 3, masc: 0, fumar: 0, fiestas: 0,
      descripcion: "Apartamento en piso 6 de edificio de ladrillo, estrato 5, con balcón y vista a los cerros orientales. Cocina integral abierta, 2 alcobas (la principal con baño y vestier), zona de ropas y 1 parqueadero cubierto. Administración de $480.000 no incluida en el canon. Portería 24 horas, ascensor y salón comunal. A pocas cuadras de la Av. Caracas, de los restaurantes de Quinta Camacho y de varias rutas de transporte. Contrato mínimo de 12 meses; se pide codeudor con finca raíz o seguro de arrendamiento." },
    { reemplaza: "Casa familiar en Medellín",
      titulo: "Casa en conjunto cerrado en Envigado", ciudad: "Envigado", precio: 4300000,
      imagen: "/img/propiedades/p3.svg", contacto: "+57 300 555 0102", tipo: "casa",
      hab: 3, banos: 3, metros: 145, direccion: "Transversal Intermedia #31 Sur, Loma del Esmeraldal", lat: 6.1660, lng: -75.5780,
      max: 6, masc: 1, fumar: 0, fiestas: 0,
      descripcion: "Casa de 3 niveles en conjunto cerrado con vigilancia 24 horas, estrato 5. Sala-comedor con doble altura, cocina integral con isla, 3 alcobas con closet, estudio, patio de ropas y terraza con zona BBQ. 2 parqueaderos. Administración de $390.000 incluida en el canon. Zonas verdes y parque infantil dentro del conjunto, cerca de colegios y centros comerciales. Se aceptan mascotas pequeñas y medianas. Contrato mínimo de 12 meses." },
    { reemplaza: "Apartamento en Cartagena",
      titulo: "Apartamento frente al mar en Bocagrande", ciudad: "Cartagena", precio: 5200000,
      imagen: "/img/propiedades/p5.svg", contacto: "+57 300 555 0103", tipo: "apartamento",
      hab: 2, banos: 2, metros: 78, direccion: "Avenida San Martín #6-45, Bocagrande", lat: 10.4015, lng: -75.5565,
      max: 5, masc: 0, fumar: 0, fiestas: 0,
      descripcion: "Apartamento amoblado en piso 12 con balcón y vista al mar Caribe. Aire acondicionado en sala y alcobas, cocina equipada, lavadora, WiFi y TV incluidos. Edificio con piscina, gimnasio, portería 24 horas y 1 parqueadero. Administración incluida en el canon. Ideal para ejecutivos o familias pequeñas; contrato mínimo de 6 meses. No se permiten mascotas ni reuniones." },
    { reemplaza: "Casa campestre moderna",
      titulo: "Finca campestre con jardín en La Calera", ciudad: "La Calera", precio: 6200000,
      imagen: "/img/propiedades/p7.svg", contacto: "+57 300 555 0104", tipo: "finca",
      hab: 4, banos: 3, metros: 280, direccion: "Vereda El Salitre, km 7 vía La Calera – Guasca", lat: 4.7330, lng: -73.9570,
      max: 10, masc: 1, fumar: 0, fiestas: 1,
      descripcion: "Casa campestre de un solo nivel sobre lote de 2.500 m², clima frío y vista a la montaña. Sala con chimenea, comedor para 10 personas, cocina de campo, 4 alcobas, 3 baños, corredor social con zona BBQ y 4 parqueaderos. Se aceptan mascotas y se permiten reuniones familiares con aviso previo; silencio después de las 10 p. m. Jardinería semanal incluida. A unos 30 minutos de Bogotá." },
    { reemplaza: "Estudio céntrico en Cali",
      titulo: "Apartaestudio amoblado en Laureles", ciudad: "Medellín", precio: 1750000,
      imagen: "/img/propiedades/p2.svg", contacto: "+57 300 555 0105", tipo: "estudio",
      hab: 1, banos: 1, metros: 38, direccion: "Carrera 74 #39B-15, Laureles", lat: 6.2455, lng: -75.5920,
      max: 2, masc: 0, fumar: 0, fiestas: 0,
      descripcion: "Apartaestudio completamente amoblado en el 4.º piso, estrato 4. Cama doble, escritorio, nevera, estufa, microondas y lavadora; internet de fibra incluido. Balcón con vista a zona verde. Queda cerca de la Av. Nutibara, del estadio y de estaciones del Metro. Administración incluida. Ideal para profesionales o estudiantes; máximo 2 personas y contrato mínimo de 6 meses." },
    { reemplaza: "Penthouse en Barranquilla",
      titulo: "Penthouse con terraza y jacuzzi en El Prado", ciudad: "Barranquilla", precio: 7800000,
      imagen: "/img/propiedades/p6.svg", contacto: "+57 300 555 0106", tipo: "apartamento",
      hab: 3, banos: 4, metros: 210, direccion: "Carrera 54 #70-35, El Prado", lat: 11.0000, lng: -74.8030,
      max: 6, masc: 0, fumar: 0, fiestas: 0,
      descripcion: "Penthouse de dos niveles en edificio con ascensor privado, estrato 6. Terraza de 60 m² con jacuzzi y zona BBQ, sala-comedor con ventanales y 3 alcobas con baño propio más cuarto de servicio. 3 parqueaderos y depósito. Administración de $1.100.000 no incluida. Portería 24 horas, gimnasio y piscina en el edificio. Cerca de restaurantes y clínicas del sector. Contrato mínimo de 12 meses." },
    { titulo: "Apartamento amplio en Ciudad Jardín", ciudad: "Cali", precio: 3100000,
      imagen: "/img/propiedades/p4.svg", contacto: "+57 300 555 0107", tipo: "apartamento",
      hab: 3, banos: 2, metros: 92, direccion: "Carrera 98 #16-60, Ciudad Jardín", lat: 3.3580, lng: -76.5360,
      max: 5, masc: 1, fumar: 0, fiestas: 0,
      descripcion: "Apartamento en piso 8 con balcón y buena ventilación, estrato 5. Sala-comedor amplio, cocina integral con zona de ropas, 3 alcobas (la principal con baño) y 2 parqueaderos. Conjunto con piscina, salón social, zona BBQ y vigilancia 24 horas. Administración de $520.000 no incluida. Cerca de Unicentro, de la Universidad Icesi y de las vías principales. Se aceptan mascotas de hasta 15 kg." },
    { titulo: "Apartamento en Cabecera del Llano", ciudad: "Bucaramanga", precio: 2600000,
      imagen: "/img/propiedades/p8.svg", contacto: "+57 300 555 0108", tipo: "apartamento",
      hab: 3, banos: 2, metros: 85, direccion: "Carrera 35 #52-40, Cabecera del Llano", lat: 7.1150, lng: -73.1090,
      max: 4, masc: 0, fumar: 0, fiestas: 0,
      descripcion: "Apartamento en piso 10 con vista a la ciudad, estrato 5. Cocina integral, sala-comedor, 3 alcobas, 2 baños y 1 parqueadero cubierto. Edificio con ascensor, salón social y portería 24 horas. Administración de $410.000 incluida en el canon. A pocas cuadras del Parque San Pío y de centros comerciales. Contrato de 12 meses. No se aceptan mascotas." }
  ];

  const hayPropiedades = db.exec("SELECT id FROM propiedades LIMIT 1");
  const vacia = !hayPropiedades.length || !hayPropiedades[0].values.length;
  const idDe = titulo => {
    const r = db.exec("SELECT id FROM propiedades WHERE titulo=? LIMIT 1", [titulo]);
    return r.length && r[0].values.length ? r[0].values[0][0] : null;
  };
  // ¿Hay propiedades de ejemplo antiguas por actualizar?
  const hayAntiguas = catalogo.some(c => c.reemplaza && idDe(c.reemplaza));

  for (const c of catalogo) {
    if (idDe(c.titulo)) continue;                       // ya está al día
    const campos = [c.titulo, c.ciudad, c.precio, c.imagen, c.contacto, c.descripcion, c.tipo,
                    c.hab, c.banos, c.metros, c.direccion, c.lat, c.lng, c.max, c.masc, c.fumar, c.fiestas];
    const viejoId = c.reemplaza ? idDe(c.reemplaza) : null;
    if (viejoId) {
      db.run(`UPDATE propiedades SET titulo=?,ciudad=?,precio=?,imagen=?,contacto=?,descripcion=?,tipo=?,
              habitaciones=?,banos=?,metros=?,direccion=?,latitud=?,longitud=?,max_personas=?,mascotas=?,fumar=?,fiestas=?
              WHERE id=?`, [...campos, viejoId]);
    } else if (vacia || hayAntiguas) {
      db.run(`INSERT INTO propiedades (titulo,ciudad,precio,imagen,contacto,descripcion,tipo,
              habitaciones,banos,metros,direccion,latitud,longitud,max_personas,mascotas,fumar,fiestas)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, campos);
    }
  }

  // ── Reseñas y calificaciones ─────────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS resenas (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    propiedad_id INTEGER NOT NULL,
    usuario_id   INTEGER NOT NULL,
    calificacion INTEGER NOT NULL,
    comentario   TEXT DEFAULT '',
    creado_en    TEXT DEFAULT (datetime('now')),
    UNIQUE(propiedad_id, usuario_id)
  )`);

  // ── Chat mensajes ────────────────────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS chat_mensajes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id   INTEGER NOT NULL,
    propiedad_id INTEGER,
    de_admin     INTEGER DEFAULT 0,
    mensaje      TEXT NOT NULL,
    leido        INTEGER DEFAULT 0,
    creado_en    TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (usuario_id)   REFERENCES usuarios(id)
  )`);

  // ── Notificaciones ────────────────────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS notificaciones (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id  INTEGER NOT NULL,
    tipo        TEXT NOT NULL,
    titulo      TEXT NOT NULL,
    mensaje     TEXT NOT NULL,
    leida       INTEGER DEFAULT 0,
    link        TEXT DEFAULT '',
    creado_en   TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
  )`);

  // ── Usuarios: activo flag ─────────────────────────────────────────────────────
  migrateCol("usuarios", "activo", "INTEGER DEFAULT 1");

  save();
  console.log("✅ Base de datos lista");
}

function migrateCol(table, col, def) {
  const info = db.exec(`PRAGMA table_info(${table})`);
  if (!info.length) return;
  const cols = info[0].values.map(r => r[1]);
  if (!cols.includes(col)) db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
}

function save() {
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function query(sql, params = []) {
  const res = db.exec(sql, params);
  if (!res.length) return [];
  return res[0].values.map(row =>
    Object.fromEntries(res[0].columns.map((col, i) => [col, row[i]]))
  );
}

function run(sql, params = []) {
  db.run(sql, params);
  save();
}

module.exports = { init, query, run };
