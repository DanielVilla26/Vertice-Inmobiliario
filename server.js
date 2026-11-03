const express       = require("express");
const session       = require("express-session");
const bcrypt        = require("bcryptjs");
const path          = require("path");
const multer        = require("multer");
const fs            = require("fs");
const http          = require("http");
const { Server }    = require("socket.io");
const ExcelJS       = require("exceljs");
const PDFDocument   = require("pdfkit");
const db            = require("./database");
require("./env");
const mailer        = require("./mailer");

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: "*" } });

// ── Multer imágenes propiedad ─────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "public", "uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `prop_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => file.mimetype.startsWith("image/") ? cb(null, true) : cb(new Error("Solo imágenes")) });

// ── Multer avatar ─────────────────────────────────────────────────────────────
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "public", "uploads", "avatars");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar_${req.session?.usuario?.id || "x"}_${Date.now()}${ext}`);
  }
});
const uploadAvatar = multer({ storage: avatarStorage, limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => file.mimetype.startsWith("image/") ? cb(null, true) : cb(new Error("Solo imágenes")) });

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));

const sessionMiddleware = session({
  secret: "casafacil-secret-2024",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 }
});
app.use(sessionMiddleware);

// Compartir sesión con Socket.io
io.use((socket, next) => {
  sessionMiddleware(socket.request, socket.request.res || {}, next);
});

// ── Auth guards ───────────────────────────────────────────────────────────────
// Vuelve a leer al usuario de la BD: así una cuenta desactivada pierde el acceso
// al instante y un cambio de rol se aplica sin tener que cerrar sesión.
function cargarUsuarioSesion(req) {
  const id = req.session.usuario?.id;
  if (!id) return null;
  const u = db.query("SELECT id,nombre,email,rol,avatar,activo FROM usuarios WHERE id=?", [id])[0];
  if (!u || u.activo === 0) return null;
  req.session.usuario = { ...req.session.usuario, nombre: u.nombre, email: u.email, rol: u.rol, avatar: u.avatar };
  return req.session.usuario;
}
function requireAuth(req, res, next) {
  if (!req.session.usuario) return res.status(401).json({ ok: false, error: "No autenticado" });
  if (!cargarUsuarioSesion(req))
    return req.session.destroy(() => res.status(401).json({ ok: false, error: "Sesión no válida o cuenta desactivada." }));
  next();
}
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.session.usuario.rol !== "admin")
      return res.status(403).json({ ok: false, error: "Acceso denegado" });
    next();
  });
}

const soloDigitos = (s) => String(s || "").replace(/\D/g, "");
// Convierte a número válido (o null) una coordenada; max = 90 para latitud, 180 para longitud
function coord(v, max) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= max ? n : null;
}
// Promedio y cantidad de reseñas de cada propiedad (alias p = tabla propiedades)
const COLS_CALIFICACION = `
  (SELECT ROUND(AVG(calificacion), 1) FROM resenas WHERE propiedad_id = p.id) AS calificacion_promedio,
  (SELECT COUNT(*)                    FROM resenas WHERE propiedad_id = p.id) AS total_resenas`;
// Compara teléfonos por sus últimos 10 dígitos (así "+57 300 111 2222" = "3001112222")
const mismoTelefono = (a, b) => soloDigitos(a).length >= 7 && soloDigitos(a).slice(-10) === soloDigitos(b).slice(-10);

// ── Helper: crear notificación ────────────────────────────────────────────────
function crearNotif(usuario_id, tipo, titulo, mensaje, link = "") {
  db.run("INSERT INTO notificaciones (usuario_id,tipo,titulo,mensaje,link) VALUES (?,?,?,?,?)",
    [usuario_id, tipo, titulo, mensaje, link]);
  // Emitir en tiempo real si el usuario está conectado
  io.to(`user_${usuario_id}`).emit("nueva_notif", { tipo, titulo, mensaje });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════════════════
app.post("/api/auth/registro", (req, res) => {
  const { nombre, email, password, telefono } = req.body;
  if (!nombre || !email || !password || !telefono)
    return res.status(400).json({ ok: false, error: "Todos los campos son obligatorios." });
  if (soloDigitos(telefono).length < 7)
    return res.status(400).json({ ok: false, error: "Ingresa un teléfono válido." });
  if (password.length < 6)
    return res.status(400).json({ ok: false, error: "La contraseña debe tener al menos 6 caracteres." });
  if (db.query("SELECT id FROM usuarios WHERE email=?", [email]).length)
    return res.status(409).json({ ok: false, error: "El email ya está registrado." });

  const hash = bcrypt.hashSync(password, 10);
  db.run("INSERT INTO usuarios (nombre,email,password,rol,telefono) VALUES (?,?,?,?,?)", [nombre, email, hash, "usuario", telefono.trim()]);
  const user = db.query("SELECT id,nombre,email,rol,avatar FROM usuarios WHERE email=?", [email])[0];
  req.session.usuario = user;
  mailer.bienvenida({ email: user.email, nombre: user.nombre });
  crearNotif(user.id, "bienvenida", "¡Bienvenido!", `Hola ${nombre}, ya puedes explorar propiedades y agendar visitas.`);
  res.json({ ok: true, usuario: user });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ ok: false, error: "Email y contraseña requeridos." });
  const user = db.query("SELECT * FROM usuarios WHERE email=?", [email])[0];
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ ok: false, error: "Credenciales incorrectas." });
  if (user.activo === 0)
    return res.status(403).json({ ok: false, error: "Cuenta desactivada. Contacta al administrador." });
  const { password: _, ...userData } = user;
  req.session.usuario = userData;
  res.json({ ok: true, usuario: userData });
});

app.post("/api/auth/restablecer", (req, res) => {
  const { email, telefono, nuevaPassword } = req.body;
  if (!email || !telefono || !nuevaPassword) return res.status(400).json({ ok: false, error: "Faltan campos." });
  if (nuevaPassword.length < 6) return res.status(400).json({ ok: false, error: "Mínimo 6 caracteres." });
  const user = db.query("SELECT id,telefono FROM usuarios WHERE email=?", [email])[0];
  // Mismo mensaje si el email no existe o el teléfono no coincide
  if (!user || !mismoTelefono(user.telefono, telefono))
    return res.status(400).json({ ok: false, error: "El email y el teléfono no coinciden con ninguna cuenta." });
  db.run("UPDATE usuarios SET password=? WHERE email=?", [bcrypt.hashSync(nuevaPassword, 10), email]);
  res.json({ ok: true, mensaje: "Contraseña actualizada correctamente." });
});

app.post("/api/auth/logout", (req, res) => { req.session.destroy(); res.json({ ok: true }); });
app.get("/api/auth/me", (req, res) => {
  if (!req.session.usuario || !cargarUsuarioSesion(req)) return res.json({ ok: false });
  res.json({ ok: true, usuario: req.session.usuario });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PERFIL
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/api/perfil", requireAuth, (req, res) => {
  const u = db.query("SELECT id,nombre,email,rol,avatar,telefono,bio,creado_en FROM usuarios WHERE id=?", [req.session.usuario.id])[0];
  if (!u) return res.status(404).json({ ok: false });
  res.json(u);
});
app.put("/api/perfil", requireAuth, (req, res) => {
  const { nombre, telefono, bio } = req.body;
  if (!nombre) return res.status(400).json({ ok: false, error: "El nombre es obligatorio." });
  db.run("UPDATE usuarios SET nombre=?,telefono=?,bio=? WHERE id=?", [nombre, telefono||"", bio||"", req.session.usuario.id]);
  req.session.usuario = { ...req.session.usuario, nombre };
  res.json({ ok: true, mensaje: "Perfil actualizado." });
});
app.post("/api/perfil/avatar", requireAuth, uploadAvatar.single("avatar"), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: "No se recibió imagen." });
  const url = `/uploads/avatars/${req.file.filename}`;
  db.run("UPDATE usuarios SET avatar=? WHERE id=?", [url, req.session.usuario.id]);
  res.json({ ok: true, avatar: url });
});
app.put("/api/perfil/password", requireAuth, (req, res) => {
  const { actual, nueva } = req.body;
  if (!actual || !nueva) return res.status(400).json({ ok: false, error: "Faltan campos." });
  if (nueva.length < 6) return res.status(400).json({ ok: false, error: "Mínimo 6 caracteres." });
  const u = db.query("SELECT password FROM usuarios WHERE id=?", [req.session.usuario.id])[0];
  if (!u || !bcrypt.compareSync(actual, u.password))
    return res.status(401).json({ ok: false, error: "Contraseña actual incorrecta." });
  db.run("UPDATE usuarios SET password=? WHERE id=?", [bcrypt.hashSync(nueva, 10), req.session.usuario.id]);
  res.json({ ok: true, mensaje: "Contraseña actualizada." });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GESTIÓN DE USUARIOS (admin)
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/api/usuarios", requireAdmin, (req, res) => {
  const usuarios = db.query("SELECT id,nombre,email,rol,activo,avatar,telefono,creado_en FROM usuarios ORDER BY creado_en DESC");
  res.json(usuarios);
});
app.put("/api/usuarios/:id/activo", requireAdmin, (req, res) => {
  const { activo } = req.body;
  const uid = req.params.id;
  if (Number(uid) === req.session.usuario.id)
    return res.status(400).json({ ok: false, error: "No puedes desactivarte a ti mismo." });
  db.run("UPDATE usuarios SET activo=? WHERE id=?", [activo ? 1 : 0, uid]);
  res.json({ ok: true });
});
app.put("/api/usuarios/:id/rol", requireAdmin, (req, res) => {
  const { rol } = req.body;
  if (!["admin","usuario"].includes(rol)) return res.status(400).json({ ok: false, error: "Rol inválido." });
  db.run("UPDATE usuarios SET rol=? WHERE id=?", [rol, req.params.id]);
  res.json({ ok: true });
});
app.delete("/api/usuarios/:id", requireAdmin, (req, res) => {
  if (Number(req.params.id) === req.session.usuario.id)
    return res.status(400).json({ ok: false, error: "No puedes eliminarte a ti mismo." });
  for (const tabla of ["reservas", "favoritos", "notificaciones", "chat_mensajes", "resenas"])
    db.run(`DELETE FROM ${tabla} WHERE usuario_id=?`, [req.params.id]);
  db.run("DELETE FROM usuarios WHERE id=?", [req.params.id]);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICACIONES
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/api/notificaciones", requireAuth, (req, res) => {
  const notifs = db.query("SELECT * FROM notificaciones WHERE usuario_id=? ORDER BY creado_en DESC LIMIT 30", [req.session.usuario.id]);
  res.json(notifs);
});
app.get("/api/notificaciones/no-leidas", requireAuth, (req, res) => {
  const count = db.query("SELECT COUNT(*) AS n FROM notificaciones WHERE usuario_id=? AND leida=0", [req.session.usuario.id])[0].n;
  res.json({ count });
});
app.put("/api/notificaciones/leer-todas", requireAuth, (req, res) => {
  db.run("UPDATE notificaciones SET leida=1 WHERE usuario_id=?", [req.session.usuario.id]);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/api/chat/:usuarioId", requireAuth, (req, res) => {
  const uid = req.session.usuario;
  // Admin puede ver cualquier conversación; usuario solo la suya
  const targetId = uid.rol === "admin" ? req.params.usuarioId : uid.id;
  const msgs = db.query(`
    SELECT m.*, u.nombre AS nombre_usuario
    FROM chat_mensajes m
    JOIN usuarios u ON m.usuario_id = u.id
    WHERE m.usuario_id=? ORDER BY m.creado_en ASC`, [targetId]);
  // Marcar como leídos los mensajes del otro lado
  if (uid.rol === "admin") {
    db.run("UPDATE chat_mensajes SET leido=1 WHERE usuario_id=? AND de_admin=0", [targetId]);
  } else {
    db.run("UPDATE chat_mensajes SET leido=1 WHERE usuario_id=? AND de_admin=1", [uid.id]);
  }
  res.json(msgs);
});

// Listar conversaciones (admin)
app.get("/api/chat/conversaciones/lista", requireAdmin, (req, res) => {
  const convs = db.query(`
    SELECT u.id, u.nombre, u.email, u.avatar,
      (SELECT COUNT(*) FROM chat_mensajes WHERE usuario_id=u.id AND de_admin=0 AND leido=0) AS no_leidos,
      (SELECT mensaje FROM chat_mensajes WHERE usuario_id=u.id ORDER BY creado_en DESC LIMIT 1) AS ultimo_msg,
      (SELECT creado_en FROM chat_mensajes WHERE usuario_id=u.id ORDER BY creado_en DESC LIMIT 1) AS ultimo_en
    FROM usuarios u
    WHERE u.rol='usuario' AND EXISTS (SELECT 1 FROM chat_mensajes WHERE usuario_id=u.id)
    ORDER BY ultimo_en DESC`);
  res.json(convs);
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROPIEDADES
// ═══════════════════════════════════════════════════════════════════════════════
// Convierte lo que llega del formulario (1/0, "1"/"0", true/false) a 1 o 0
function sino(v, porDefecto = 1) {
  if (v === undefined || v === null || v === "") return porDefecto;
  return (v === 0 || v === "0" || v === false || v === "false") ? 0 : 1;
}
function maxPersonas(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 99) : 0;
}

app.get("/api/propiedades", (req, res) => {
  const { ciudad, precioMin, precioMax, tipo, habitaciones, banos, metrosMin, mascotas, personas } = req.query;
  let sql = `SELECT p.*, ${COLS_CALIFICACION} FROM propiedades p WHERE p.activa=1`;
  const params = [];
  if (ciudad)       { sql += " AND ciudad LIKE ?";    params.push(`%${ciudad}%`); }
  if (precioMin)    { sql += " AND precio >= ?";       params.push(Number(precioMin)); }
  if (precioMax)    { sql += " AND precio <= ?";       params.push(Number(precioMax)); }
  if (tipo)         { sql += " AND tipo = ?";          params.push(tipo); }
  if (habitaciones) { sql += " AND habitaciones >= ?"; params.push(Number(habitaciones)); }
  if (banos)        { sql += " AND banos >= ?";        params.push(Number(banos)); }
  if (metrosMin)    { sql += " AND metros >= ?";       params.push(Number(metrosMin)); }
  if (mascotas === "1") sql += " AND COALESCE(mascotas,1) = 1";
  if (personas)     { sql += " AND (COALESCE(max_personas,0) = 0 OR max_personas >= ?)"; params.push(Number(personas)); }
  sql += " ORDER BY id DESC";
  res.json(db.query(sql, params));
});
app.get("/api/propiedades/:id", (req, res) => {
  const prop = db.query(`SELECT p.*, ${COLS_CALIFICACION} FROM propiedades p WHERE p.id=? AND p.activa=1`, [req.params.id])[0];
  if (!prop) return res.status(404).json({ ok: false, error: "No encontrada" });
  res.json(prop);
});
app.post("/api/propiedades", requireAdmin, (req, res) => {
  const { titulo, ciudad, precio, imagen, contacto, descripcion, tipo, habitaciones, banos, metros, direccion, latitud, longitud, max_personas, mascotas, fumar, fiestas } = req.body;
  if (!titulo || !ciudad || !precio)
    return res.status(400).json({ ok: false, error: "Título, ciudad y precio son obligatorios." });
  db.run("INSERT INTO propiedades (titulo,ciudad,precio,imagen,contacto,descripcion,tipo,habitaciones,banos,metros,direccion,latitud,longitud,max_personas,mascotas,fumar,fiestas) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [titulo, ciudad, Number(precio), imagen||"", contacto||"", descripcion||"", tipo||"apartamento", Number(habitaciones)||1, Number(banos)||1, Number(metros)||0, direccion||"", coord(latitud, 90), coord(longitud, 180), maxPersonas(max_personas), sino(mascotas), sino(fumar), sino(fiestas)]);
  res.json({ ok: true, mensaje: "Propiedad creada." });
});
app.put("/api/propiedades/:id", requireAdmin, (req, res) => {
  const { titulo, ciudad, precio, imagen, contacto, descripcion, tipo, habitaciones, banos, metros, direccion, latitud, longitud, max_personas, mascotas, fumar, fiestas } = req.body;
  if (!titulo || !ciudad || !precio)
    return res.status(400).json({ ok: false, error: "Título, ciudad y precio son obligatorios." });
  db.run("UPDATE propiedades SET titulo=?,ciudad=?,precio=?,imagen=?,contacto=?,descripcion=?,tipo=?,habitaciones=?,banos=?,metros=?,direccion=?,latitud=?,longitud=?,max_personas=?,mascotas=?,fumar=?,fiestas=? WHERE id=?",
    [titulo, ciudad, Number(precio), imagen||"", contacto||"", descripcion||"", tipo||"apartamento", Number(habitaciones)||1, Number(banos)||1, Number(metros)||0, direccion||"", coord(latitud, 90), coord(longitud, 180), maxPersonas(max_personas), sino(mascotas), sino(fumar), sino(fiestas), req.params.id]);
  res.json({ ok: true, mensaje: "Propiedad actualizada." });
});
app.delete("/api/propiedades/:id", requireAdmin, (req, res) => {
  db.run("UPDATE propiedades SET activa=0 WHERE id=?", [req.params.id]);
  res.json({ ok: true, mensaje: "Propiedad eliminada." });
});

// ═══════════════════════════════════════════════════════════════════════════════
// IMÁGENES
// ═══════════════════════════════════════════════════════════════════════════════
app.post("/api/propiedades/:id/imagenes", requireAdmin, upload.array("imagenes", 10), (req, res) => {
  const propId = req.params.id;
  const orden  = db.query("SELECT COUNT(*) AS n FROM imagenes WHERE propiedad_id=?", [propId])[0].n;
  req.files.forEach((file, i) => {
    db.run("INSERT INTO imagenes (propiedad_id,url,orden) VALUES (?,?,?)", [propId, `/uploads/${file.filename}`, orden + i]);
  });
  const prop = db.query("SELECT imagen FROM propiedades WHERE id=?", [propId])[0];
  if ((!prop.imagen || !prop.imagen.startsWith("/uploads/")) && req.files.length > 0)
    db.run("UPDATE propiedades SET imagen=? WHERE id=?", [`/uploads/${req.files[0].filename}`, propId]);
  res.json({ ok: true, subidas: req.files.length });
});
app.get("/api/propiedades/:id/imagenes", (req, res) => {
  res.json(db.query("SELECT * FROM imagenes WHERE propiedad_id=? ORDER BY orden ASC", [req.params.id]));
});
app.delete("/api/imagenes/:id", requireAdmin, (req, res) => {
  const img = db.query("SELECT * FROM imagenes WHERE id=?", [req.params.id])[0];
  if (!img) return res.status(404).json({ ok: false });
  const fp = path.join(__dirname, "public", img.url);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
  db.run("DELETE FROM imagenes WHERE id=?", [req.params.id]);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FAVORITOS
// ═══════════════════════════════════════════════════════════════════════════════
// ── Reseñas ───────────────────────────────────────────────────────────────────
app.get("/api/propiedades/:id/resenas", (req, res) => {
  const resenas = db.query(
    `SELECT r.id, r.calificacion, r.comentario, r.creado_en, r.usuario_id, u.nombre
       FROM resenas r JOIN usuarios u ON u.id = r.usuario_id
      WHERE r.propiedad_id=? ORDER BY r.id DESC`, [req.params.id]);
  const total = resenas.length;
  const promedio = total ? Math.round(resenas.reduce((a, r) => a + r.calificacion, 0) / total * 10) / 10 : 0;
  res.json({ ok: true, total, promedio, resenas });
});

app.post("/api/propiedades/:id/resenas", requireAuth, (req, res) => {
  const usu = req.session.usuario;
  if (usu.rol === "admin")
    return res.status(403).json({ ok: false, error: "Los administradores no pueden dejar reseñas." });
  if (!db.query("SELECT id FROM propiedades WHERE id=? AND activa=1", [req.params.id]).length)
    return res.status(404).json({ ok: false, error: "La propiedad no existe." });
  const calificacion = Number(req.body.calificacion);
  if (!Number.isInteger(calificacion) || calificacion < 1 || calificacion > 5)
    return res.status(400).json({ ok: false, error: "La calificación debe ser de 1 a 5 estrellas." });
  const comentario = String(req.body.comentario || "").trim().slice(0, 500);

  // Una reseña por usuario y propiedad: si ya existe, se actualiza
  const previa = db.query("SELECT id FROM resenas WHERE propiedad_id=? AND usuario_id=?", [req.params.id, usu.id])[0];
  if (previa) {
    db.run("UPDATE resenas SET calificacion=?, comentario=?, creado_en=datetime('now') WHERE id=?", [calificacion, comentario, previa.id]);
  } else {
    db.run("INSERT INTO resenas (propiedad_id,usuario_id,calificacion,comentario) VALUES (?,?,?,?)", [req.params.id, usu.id, calificacion, comentario]);
  }
  res.json({ ok: true, mensaje: previa ? "Reseña actualizada." : "¡Gracias por tu reseña!" });
});

app.delete("/api/resenas/:id", requireAuth, (req, res) => {
  const r = db.query("SELECT id,usuario_id FROM resenas WHERE id=?", [req.params.id])[0];
  if (!r) return res.status(404).json({ ok: false, error: "Reseña no encontrada." });
  const usu = req.session.usuario;
  if (r.usuario_id !== usu.id && usu.rol !== "admin")
    return res.status(403).json({ ok: false, error: "No puedes borrar la reseña de otra persona." });
  db.run("DELETE FROM resenas WHERE id=?", [r.id]);
  res.json({ ok: true });
});

app.get("/api/favoritos", requireAuth, (req, res) => {
  res.json(db.query(`SELECT p.*, f.id AS fav_id FROM favoritos f JOIN propiedades p ON f.propiedad_id=p.id WHERE f.usuario_id=? AND p.activa=1 ORDER BY f.creado_en DESC`, [req.session.usuario.id]));
});
app.post("/api/favoritos/:propiedadId", requireAuth, (req, res) => {
  const uid = req.session.usuario.id;
  const pid = req.params.propiedadId;
  const existe = db.query("SELECT id FROM favoritos WHERE usuario_id=? AND propiedad_id=?", [uid, pid]);
  if (existe.length) { db.run("DELETE FROM favoritos WHERE usuario_id=? AND propiedad_id=?", [uid, pid]); res.json({ ok: true, favorito: false }); }
  else { db.run("INSERT INTO favoritos (usuario_id,propiedad_id) VALUES (?,?)", [uid, pid]); res.json({ ok: true, favorito: true }); }
});
app.get("/api/favoritos/ids", requireAuth, (req, res) => {
  res.json(db.query("SELECT propiedad_id FROM favoritos WHERE usuario_id=?", [req.session.usuario.id]).map(r => r.propiedad_id));
});

// ═══════════════════════════════════════════════════════════════════════════════
// RESERVAS
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/api/reservas/ocupadas/:propiedadId", (req, res) => {
  res.json(db.query("SELECT fecha,hora FROM reservas WHERE propiedad_id=? AND estado!='cancelada'", [req.params.propiedadId]));
});
app.get("/api/reservas/mis", requireAuth, (req, res) => {
  res.json(db.query(`SELECT r.*,p.titulo AS propiedad_titulo,p.ciudad,p.imagen FROM reservas r JOIN propiedades p ON r.propiedad_id=p.id WHERE r.usuario_id=? ORDER BY r.fecha DESC`, [req.session.usuario.id]));
});
app.get("/api/reservas/todas", requireAdmin, (req, res) => {
  res.json(db.query(`SELECT r.*,p.titulo AS propiedad_titulo,u.nombre AS usuario_nombre,u.email AS usuario_email FROM reservas r JOIN propiedades p ON r.propiedad_id=p.id JOIN usuarios u ON r.usuario_id=u.id ORDER BY r.fecha ASC`));
});
app.post("/api/reservas", requireAuth, (req, res) => {
  let { propiedad_id, fecha, hora, nota, personas, mascotas } = req.body;
  if (!propiedad_id || !fecha || !hora)
    return res.status(400).json({ ok: false, error: "Propiedad, fecha y hora son obligatorios." });
  const reglas = db.query("SELECT titulo, max_personas, mascotas FROM propiedades WHERE id=? AND activa=1", [propiedad_id])[0];
  if (!reglas)
    return res.status(404).json({ ok: false, error: "La propiedad no existe o ya no está disponible." });

  // Restricciones de la propiedad (si el usuario las informó)
  const nPersonas = parseInt(personas, 10);
  if (reglas.max_personas > 0 && nPersonas > reglas.max_personas)
    return res.status(400).json({ ok: false, error: `Esta propiedad admite máximo ${reglas.max_personas} persona${reglas.max_personas > 1 ? "s" : ""}.` });
  if (reglas.mascotas === 0 && (mascotas === true || mascotas === "1" || mascotas === 1 || mascotas === "si"))
    return res.status(400).json({ ok: false, error: "Esta propiedad no admite mascotas." });
  // Se deja constancia en la nota para que el administrador lo vea
  const datosExtra = [];
  if (nPersonas > 0) datosExtra.push(`Personas: ${nPersonas}`);
  if (mascotas === true || mascotas === "1" || mascotas === 1 || mascotas === "si") datosExtra.push("Con mascota");
  if (datosExtra.length) nota = `[${datosExtra.join(" · ")}] ${nota || ""}`.trim();
  if (db.query("SELECT id FROM reservas WHERE propiedad_id=? AND fecha=? AND hora=? AND estado!='cancelada'", [propiedad_id, fecha, hora]).length)
    return res.status(409).json({ ok: false, error: "Esa fecha y hora ya está reservada." });
  db.run("INSERT INTO reservas (usuario_id,propiedad_id,fecha,hora,nota) VALUES (?,?,?,?,?)", [req.session.usuario.id, propiedad_id, fecha, hora, nota||""]);

  const prop  = db.query("SELECT titulo FROM propiedades WHERE id=?", [propiedad_id])[0];
  const usu   = db.query("SELECT nombre,email FROM usuarios WHERE id=?", [req.session.usuario.id])[0];
  const admins = db.query("SELECT id,email FROM usuarios WHERE rol='admin' AND COALESCE(activo,1)=1");
  const fechaFmt = new Date(fecha).toLocaleDateString("es-CO", { weekday:"long", year:"numeric", month:"long", day:"numeric" });

  mailer.reservaConfirmadaUsuario({ email: usu.email, nombre: usu.nombre, propiedad: prop.titulo, fecha: fechaFmt, hora, nota: nota||"" });
  for (const admin of admins) {
    mailer.reservaNuevaAdmin({ emailAdmin: process.env.ADMIN_NOTIFY_EMAIL || admin.email, usuario: usu.nombre, email: usu.email, propiedad: prop.titulo, fecha: fechaFmt, hora, nota: nota||"" });
    crearNotif(admin.id, "reserva", "Nueva reserva", `${usu.nombre} agendó visita a "${prop.titulo}" el ${fechaFmt} a las ${hora}`);
  }
  crearNotif(req.session.usuario.id, "reserva", "Visita agendada", `Tu visita a "${prop.titulo}" quedó programada para el ${fechaFmt} a las ${hora}`);
  res.json({ ok: true, mensaje: "Visita agendada exitosamente." });
});
app.delete("/api/reservas/:id", requireAuth, (req, res) => {
  const reserva = db.query("SELECT * FROM reservas WHERE id=?", [req.params.id])[0];
  if (!reserva) return res.status(404).json({ ok: false, error: "No encontrada." });
  const esAdmin = req.session.usuario.rol === "admin";
  const esDueno = reserva.usuario_id === req.session.usuario.id;
  if (!esAdmin && !esDueno) return res.status(403).json({ ok: false, error: "Sin permiso." });
  db.run("UPDATE reservas SET estado='cancelada' WHERE id=?", [req.params.id]);
  res.json({ ok: true });
});
app.put("/api/reservas/:id/estado", requireAdmin, (req, res) => {
  const { estado } = req.body;
  if (!["pendiente", "confirmada", "cancelada"].includes(estado))
    return res.status(400).json({ ok: false, error: "Estado inválido." });
  if (!db.query("SELECT id FROM reservas WHERE id=?", [req.params.id]).length)
    return res.status(404).json({ ok: false, error: "Reserva no encontrada." });
  db.run("UPDATE reservas SET estado=? WHERE id=?", [estado, req.params.id]);
  const r = db.query(`SELECT r.fecha,r.hora,u.email,u.nombre,u.id AS uid,p.titulo FROM reservas r JOIN usuarios u ON r.usuario_id=u.id JOIN propiedades p ON r.propiedad_id=p.id WHERE r.id=?`, [req.params.id])[0];
  if (r && (estado === "confirmada" || estado === "cancelada")) {
    const fechaFmt = new Date(r.fecha).toLocaleDateString("es-CO", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
    mailer.reservaEstadoCambiado({ email: r.email, nombre: r.nombre, propiedad: r.titulo, fecha: fechaFmt, hora: r.hora, estado });
    const icon = estado === "confirmada" ? "✅" : "❌";
    crearNotif(r.uid, "reserva", `Reserva ${estado}`, `${icon} Tu visita a "${r.titulo}" fue ${estado}.`);
  }
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STATS DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
// ── Resumen de actividad (panel del admin) ───────────────────────────────────
const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sept", "Oct", "Nov", "Dic"];

app.get("/api/stats/actividad", requireAdmin, (req, res) => {
  // Los 6 últimos meses, el actual incluido (p. ej. May, Jun, Jul, Ago, Sept, Oct)
  const hoy = new Date();
  const meses = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push({
      clave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      etiqueta: MESES_CORTOS[d.getMonth()],
      usuarios: 0, propiedades: 0, reservas: 0
    });
  }
  // Registros nuevos por mes (la fecha se guarda en UTC: se pasa a hora local para agrupar)
  const contarPorMes = (tabla, where) => {
    const filas = db.query(`SELECT strftime('%Y-%m', creado_en, 'localtime') AS mes, COUNT(*) AS n FROM ${tabla} WHERE ${where} GROUP BY mes`);
    for (const f of filas) {
      const m = meses.find(x => x.clave === f.mes);
      if (m) m[tabla] = f.n;
    }
  };
  contarPorMes("usuarios", "rol='usuario'");
  contarPorMes("propiedades", "activa=1");
  contarPorMes("reservas", "1=1");

  const una = (sql) => db.query(sql)[0];
  const tarjetas = {
    reservasConfirmadas: una("SELECT COUNT(*) AS n FROM reservas WHERE estado='confirmada'").n,
    reservasCanceladas:  una("SELECT COUNT(*) AS n FROM reservas WHERE estado='cancelada'").n,
    favoritosGuardados:  una("SELECT COUNT(*) AS n FROM favoritos f JOIN propiedades p ON p.id=f.propiedad_id WHERE p.activa=1").n,
    promedioResenas:     una("SELECT ROUND(AVG(r.calificacion), 1) AS n FROM resenas r JOIN propiedades p ON p.id=r.propiedad_id WHERE p.activa=1").n || 0,
    totalResenas:        una("SELECT COUNT(*) AS n FROM resenas r JOIN propiedades p ON p.id=r.propiedad_id WHERE p.activa=1").n
  };

  const masGuardadas = db.query(
    `SELECT p.id, p.titulo, p.ciudad, COUNT(*) AS total
       FROM favoritos f JOIN propiedades p ON p.id=f.propiedad_id
      WHERE p.activa=1 GROUP BY p.id ORDER BY total DESC, p.titulo LIMIT 5`);
  const mejorValoradas = db.query(
    `SELECT p.id, p.titulo, p.ciudad, ROUND(AVG(r.calificacion), 1) AS promedio, COUNT(*) AS total
       FROM resenas r JOIN propiedades p ON p.id=r.propiedad_id
      WHERE p.activa=1 GROUP BY p.id ORDER BY promedio DESC, total DESC, p.titulo LIMIT 5`);

  res.json({ ok: true, tarjetas, meses, masGuardadas, mejorValoradas });
});

app.get("/api/stats", requireAdmin, (req, res) => {
  const totalProp     = db.query("SELECT COUNT(*) AS n FROM propiedades WHERE activa=1")[0].n;
  const totalUsuarios = db.query("SELECT COUNT(*) AS n FROM usuarios WHERE rol='usuario'")[0].n;
  const totalReservas = db.query("SELECT COUNT(*) AS n FROM reservas WHERE estado!='cancelada'")[0].n;
  const pendientes    = db.query("SELECT COUNT(*) AS n FROM reservas WHERE estado='pendiente'")[0].n;
  const porCiudad     = db.query("SELECT ciudad,COUNT(*) AS total FROM propiedades WHERE activa=1 GROUP BY ciudad ORDER BY total DESC");
  const recientes     = db.query(`SELECT r.fecha,r.hora,r.estado,p.titulo,u.nombre AS usuario FROM reservas r JOIN propiedades p ON r.propiedad_id=p.id JOIN usuarios u ON r.usuario_id=u.id ORDER BY r.creado_en DESC LIMIT 5`);
  res.json({ totalProp, totalUsuarios, totalReservas, pendientes, porCiudad, recientes });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTES
// ═══════════════════════════════════════════════════════════════════════════════

// Excel
app.get("/api/reportes/excel", requireAdmin, async (req, res) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Vértice Inmobiliario";

  // Hoja 1: Reservas
  const wsR = wb.addWorksheet("Reservas");
  wsR.columns = [
    { header: "ID",         key: "id",         width: 6  },
    { header: "Propiedad",  key: "propiedad",  width: 32 },
    { header: "Usuario",    key: "usuario",    width: 22 },
    { header: "Email",      key: "email",      width: 26 },
    { header: "Fecha",      key: "fecha",      width: 14 },
    { header: "Hora",       key: "hora",       width: 10 },
    { header: "Estado",     key: "estado",     width: 14 },
    { header: "Registrado", key: "creado_en",  width: 20 }
  ];
  wsR.getRow(1).font = { bold: true };
  wsR.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
  wsR.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  const reservas = db.query(`SELECT r.*,p.titulo AS propiedad,u.nombre AS usuario,u.email FROM reservas r JOIN propiedades p ON r.propiedad_id=p.id JOIN usuarios u ON r.usuario_id=u.id ORDER BY r.fecha DESC`);
  reservas.forEach(r => wsR.addRow(r));

  // Hoja 2: Propiedades
  const wsP = wb.addWorksheet("Propiedades");
  wsP.columns = [
    { header: "ID",          key: "id",          width: 6  },
    { header: "Título",      key: "titulo",       width: 32 },
    { header: "Ciudad",      key: "ciudad",       width: 16 },
    { header: "Tipo",        key: "tipo",         width: 14 },
    { header: "Precio",      key: "precio",       width: 14 },
    { header: "Habitaciones",key: "habitaciones", width: 14 },
    { header: "Baños",       key: "banos",        width: 8  },
    { header: "Metros",      key: "metros",       width: 8  },
    { header: "Dirección",   key: "direccion",    width: 28 }
  ];
  wsP.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  wsP.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF065F46" } };
  db.query("SELECT * FROM propiedades WHERE activa=1 ORDER BY id").forEach(p => wsP.addRow(p));

  // Hoja 3: Usuarios
  const wsU = wb.addWorksheet("Usuarios");
  wsU.columns = [
    { header: "ID",       key: "id",        width: 6  },
    { header: "Nombre",   key: "nombre",    width: 22 },
    { header: "Email",    key: "email",     width: 28 },
    { header: "Rol",      key: "rol",       width: 10 },
    { header: "Activo",   key: "activo",    width: 8  },
    { header: "Registro", key: "creado_en", width: 22 }
  ];
  wsU.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  wsU.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF92400E" } };
  db.query("SELECT id,nombre,email,rol,activo,creado_en FROM usuarios ORDER BY creado_en DESC").forEach(u => wsU.addRow(u));

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="vertice_reporte_${new Date().toISOString().slice(0,10)}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

// PDF
app.get("/api/reportes/pdf", requireAdmin, (req, res) => {
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="vertice_reporte_${new Date().toISOString().slice(0,10)}.pdf"`);
  doc.pipe(res);

  const ahora = new Date().toLocaleDateString("es-CO", { year:"numeric", month:"long", day:"numeric" });

  // Encabezado
  doc.rect(0, 0, doc.page.width, 70).fill("#1e40af");
  doc.fillColor("white").fontSize(22).font("Helvetica-Bold").text("Vértice Inmobiliario", 40, 18);
  doc.fontSize(11).font("Helvetica").text(`Reporte general — ${ahora}`, 40, 46);
  doc.fillColor("#0f172a");
  doc.y = 90;

  // Stats
  const totalProp     = db.query("SELECT COUNT(*) AS n FROM propiedades WHERE activa=1")[0].n;
  const totalUsuarios = db.query("SELECT COUNT(*) AS n FROM usuarios WHERE rol='usuario'")[0].n;
  const totalReservas = db.query("SELECT COUNT(*) AS n FROM reservas")[0].n;
  const confirmadas   = db.query("SELECT COUNT(*) AS n FROM reservas WHERE estado='confirmada'")[0].n;

  doc.fontSize(13).font("Helvetica-Bold").text("Resumen ejecutivo", 40, doc.y);
  doc.moveDown(0.5);
  const stats = [
    ["Propiedades activas", totalProp],
    ["Usuarios registrados", totalUsuarios],
    ["Total reservas", totalReservas],
    ["Reservas confirmadas", confirmadas],
  ];
  stats.forEach(([label, val]) => {
    doc.fontSize(11).font("Helvetica").fillColor("#334155").text(`• ${label}: `, { continued: true });
    doc.font("Helvetica-Bold").fillColor("#1e40af").text(String(val));
  });

  doc.moveDown(1);

  // Tabla reservas recientes
  doc.fontSize(13).font("Helvetica-Bold").fillColor("#0f172a").text("Últimas 10 reservas");
  doc.moveDown(0.4);

  const reservas = db.query(`SELECT r.fecha,r.hora,r.estado,p.titulo,u.nombre FROM reservas r JOIN propiedades p ON r.propiedad_id=p.id JOIN usuarios u ON r.usuario_id=u.id ORDER BY r.creado_en DESC LIMIT 10`);
  const colWidths = [90, 160, 80, 70, 70];
  const headers   = ["Fecha", "Propiedad", "Usuario", "Hora", "Estado"];
  let x = 40, y = doc.y;

  // Header row
  doc.rect(x, y, colWidths.reduce((a,b)=>a+b), 18).fill("#1e40af");
  headers.forEach((h, i) => {
    const cx = colWidths.slice(0, i).reduce((a,b)=>a+b, x);
    doc.fillColor("white").fontSize(9).font("Helvetica-Bold").text(h, cx + 4, y + 4, { width: colWidths[i] - 8 });
  });
  y += 18;

  reservas.forEach((r, ri) => {
    const bg = ri % 2 === 0 ? "#f8fafc" : "white";
    doc.rect(x, y, colWidths.reduce((a,b)=>a+b), 16).fill(bg);
    const row = [r.fecha, r.titulo.slice(0,22), r.nombre.slice(0,14), r.hora, r.estado];
    row.forEach((v, i) => {
      const cx = colWidths.slice(0, i).reduce((a,b)=>a+b, x);
      const color = v === "confirmada" ? "#065f46" : v === "cancelada" ? "#991b1b" : "#334155";
      doc.fillColor(color).fontSize(8).font("Helvetica").text(String(v||""), cx + 4, y + 3, { width: colWidths[i] - 8 });
    });
    y += 16;
  });

  doc.end();
});

// ═══════════════════════════════════════════════════════════════════════════════
// SOCKET.IO — CHAT EN TIEMPO REAL
// ═══════════════════════════════════════════════════════════════════════════════
io.on("connection", (socket) => {
  const usuario = socket.request.session?.usuario;
  if (!usuario) return socket.disconnect();

  socket.join(`user_${usuario.id}`);
  if (usuario.rol === "admin") socket.join("admins");

  // Enviar mensaje
  socket.on("chat:enviar", ({ destinatarioId, mensaje, propiedadId }) => {
    if (!mensaje?.trim()) return;
    const actual = db.query("SELECT rol,activo FROM usuarios WHERE id=?", [usuario.id])[0];
    if (!actual || actual.activo === 0) return socket.disconnect();
    const esAdmin  = actual.rol === "admin";
    if (esAdmin && !db.query("SELECT id FROM usuarios WHERE id=?", [destinatarioId]).length) return;
    const uid      = esAdmin ? destinatarioId : usuario.id;
    const deAdmin  = esAdmin ? 1 : 0;

    db.run("INSERT INTO chat_mensajes (usuario_id,propiedad_id,de_admin,mensaje) VALUES (?,?,?,?)",
      [uid, propiedadId || null, deAdmin, mensaje.trim()]);

    const msgData = {
      usuario_id: uid,
      de_admin: deAdmin,
      mensaje: mensaje.trim(),
      creado_en: new Date().toISOString(),
      nombre_usuario: usuario.nombre
    };

    // Emitir al usuario destino y a todos los admins
    socket.to(`user_${uid}`).emit("chat:mensaje", msgData);
    socket.to("admins").emit("chat:mensaje", { ...msgData, _conv_uid: uid });
    socket.emit("chat:mensaje", msgData); // eco al remitente

    // Notificación si es usuario escribiendo al admin
    if (!esAdmin) {
      const prop = propiedadId ? db.query("SELECT titulo FROM propiedades WHERE id=?", [propiedadId])[0] : null;
      io.to("admins").emit("chat:nuevo", { uid: usuario.id, nombre: usuario.nombre, prop: prop?.titulo });
    }
  });

  socket.on("disconnect", () => {});
});

// ── SPA fallback ──────────────────────────────────────────────────────────────
app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── Arranque ──────────────────────────────────────────────────────────────────
db.init().then(() => {
  server.listen(3000, () => {
    console.log("🏠 Vértice Inmobiliario → http://localhost:3000");
    mailer.verificar();   // si hay Gmail configurado, comprueba que las credenciales funcionen
  });
});
