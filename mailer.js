const nodemailer = require("nodemailer");
require("./env");

// ── Configuración ──────────────────────────────────────────────────────────────
// • Con GMAIL_USER y GMAIL_APP_PASSWORD en el archivo .env → se envían correos REALES por Gmail.
// • Sin ellos → modo pruebas con Ethereal (correos falsos que se ven en un enlace de la consola).
let transporter = null;
let modoReal    = false;
let remitente   = '"Vértice Inmobiliario" <noreply@verticeinmobiliario.com>';

// Escapa texto antes de meterlo en el HTML del correo
const e = (s) => String(s ?? "").replace(/[&<>"']/g, c => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

async function getTransporter() {
  if (transporter) return transporter;

  const user = (process.env.GMAIL_USER || "").trim();
  const pass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, ""); // Google la muestra con espacios
  if (user && pass) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass }
    });
    modoReal  = true;
    remitente = `"Vértice Inmobiliario" <${user}>`;
    console.log(`📧 Correo real activado (Gmail: ${user})`);
    return transporter;
  }

  // Modo pruebas: cuenta Ethereal automática
  const testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    auth: { user: testAccount.user, pass: testAccount.pass }
  });
  console.log("📧 Modo pruebas (Ethereal) → los correos NO llegan a bandejas reales");
  console.log("   Para correos reales configura Gmail en el archivo .env (mira el README)");
  console.log(`   Usuario: ${testAccount.user}`);
  return transporter;
}

// Comprueba al arrancar que las credenciales de Gmail funcionan (solo si están configuradas)
async function verificar() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return false;
  try {
    const t = await getTransporter();
    await t.verify();
    console.log("✅ Gmail: credenciales correctas, listo para enviar");
    return true;
  } catch (err) {
    console.error("❌ Gmail no pudo iniciar sesión:", err.message);
    console.error("   Revisa GMAIL_USER y GMAIL_APP_PASSWORD en el archivo .env (debe ser una contraseña de aplicación)");
    return false;
  }
}

// ── Plantilla base HTML ────────────────────────────────────────────────────────
function template(titulo, contenido) {
  return `
  <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <style>
    body{font-family:Arial,sans-serif;background:#f5f7fb;margin:0;padding:20px;}
    .card{background:white;max-width:560px;margin:0 auto;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1);}
    .header{background:linear-gradient(135deg,#1e40af,#3b82f6);padding:28px 24px;color:white;}
    .header h1{margin:0;font-size:22px;}
    .header p{margin:6px 0 0;opacity:.85;font-size:14px;}
    .body{padding:24px;}
    .body p{color:#334155;line-height:1.7;font-size:15px;margin:0 0 12px;}
    .highlight{background:#eff6ff;border-left:4px solid #3b82f6;padding:14px 16px;border-radius:0 8px 8px 0;margin:16px 0;}
    .highlight p{margin:4px 0;font-size:14px;color:#1e40af;}
    .btn{display:inline-block;background:linear-gradient(135deg,#3b82f6,#1e40af);color:white;padding:12px 28px;border-radius:10px;text-decoration:none;font-size:15px;margin-top:8px;}
    .footer{background:#f8fafc;padding:16px 24px;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;}
  </style></head><body>
  <div class="card">
    <div class="header">
      <h1>🏠 Vértice Inmobiliario</h1>
      <p>${titulo}</p>
    </div>
    <div class="body">${contenido}</div>
    <div class="footer">Este es un mensaje automático de Vértice Inmobiliario. Por favor no respondas este correo.</div>
  </div></body></html>`;
}

// ── Enviar email ───────────────────────────────────────────────────────────────
async function send({ to, subject, html }) {
  try {
    const t = await getTransporter();
    // Los correos @verticeinmobiliario.com (como el del admin por defecto) no existen: no se envían en modo real
    if (modoReal && /@(verticeinmobiliario|casafacil)\.com$/i.test(to)) {
      console.log(`📧 Omitido: ${to} es un correo de ejemplo (define ADMIN_NOTIFY_EMAIL en .env o cambia el correo del admin)`);
      return false;
    }
    const info = await t.sendMail({ from: remitente, to, subject, html });
    if (modoReal) {
      console.log(`📧 Email enviado a ${to}`);
    } else {
      const preview = nodemailer.getTestMessageUrl(info);
      if (preview) console.log(`📧 Email de prueba → ${preview}`);
    }
    return true;
  } catch (err) {
    console.error("❌ Error email:", err.message);
    return false;
  }
}

// ── Plantillas específicas ─────────────────────────────────────────────────────

// Confirmación de reserva para el usuario
async function reservaConfirmadaUsuario({ email, nombre, propiedad, fecha, hora, nota }) {
  const html = template("Visita agendada", `
    <p>Hola <strong>${e(nombre)}</strong>, tu visita ha sido agendada exitosamente. 🎉</p>
    <div class="highlight">
      <p><strong>🏠 Propiedad:</strong> ${e(propiedad)}</p>
      <p><strong>📅 Fecha:</strong> ${e(fecha)}</p>
      <p><strong>🕐 Hora:</strong> ${e(hora)}</p>
      ${nota ? `<p><strong>📝 Nota:</strong> ${e(nota)}</p>` : ""}
    </div>
    <p>Recibirás una confirmación del agente pronto. Si necesitas cancelar, puedes hacerlo desde tu perfil.</p>
  `);
  return send({ to: email, subject: `✅ Visita agendada — ${propiedad}`, html });
}

// Aviso al admin cuando llega una reserva
async function reservaNuevaAdmin({ emailAdmin, usuario, email, propiedad, fecha, hora, nota }) {
  const html = template("Nueva reserva de visita", `
    <p>Se ha recibido una nueva solicitud de visita.</p>
    <div class="highlight">
      <p><strong>👤 Usuario:</strong> ${e(usuario)} (${e(email)})</p>
      <p><strong>🏠 Propiedad:</strong> ${e(propiedad)}</p>
      <p><strong>📅 Fecha:</strong> ${e(fecha)}</p>
      <p><strong>🕐 Hora:</strong> ${e(hora)}</p>
      ${nota ? `<p><strong>📝 Nota:</strong> ${e(nota)}</p>` : ""}
    </div>
    <p>Ingresa al panel de administración para confirmar o cancelar la visita.</p>
  `);
  return send({ to: emailAdmin, subject: `📅 Nueva reserva — ${propiedad}`, html });
}

// Cambio de estado de reserva
async function reservaEstadoCambiado({ email, nombre, propiedad, fecha, hora, estado }) {
  const icon  = estado === "confirmada" ? "✅" : "❌";
  const texto = estado === "confirmada"
    ? "Tu visita ha sido <strong>confirmada</strong> por el agente. ¡Te esperamos!"
    : "Tu visita ha sido <strong>cancelada</strong>. Puedes agendar una nueva fecha desde la plataforma.";

  const html = template(`Reserva ${estado}`, `
    <p>Hola <strong>${e(nombre)}</strong>,</p>
    <p>${texto}</p>
    <div class="highlight">
      <p><strong>🏠 Propiedad:</strong> ${e(propiedad)}</p>
      <p><strong>📅 Fecha:</strong> ${e(fecha)}</p>
      <p><strong>🕐 Hora:</strong> ${e(hora)}</p>
    </div>
  `);
  return send({ to: email, subject: `${icon} Reserva ${estado} — ${propiedad}`, html });
}

// Bienvenida al registrarse
async function bienvenida({ email, nombre }) {
  const html = template("Bienvenido a Vértice Inmobiliario", `
    <p>Hola <strong>${e(nombre)}</strong>, ¡bienvenido a Vértice Inmobiliario! 🏠</p>
    <p>Ya puedes explorar nuestro catálogo de propiedades, agendar visitas y guardar tus favoritos.</p>
    <p>Si tienes alguna duda, escríbenos en cualquier momento.</p>
  `);
  return send({ to: email, subject: "🏠 Bienvenido a Vértice Inmobiliario", html });
}

module.exports = { reservaConfirmadaUsuario, reservaNuevaAdmin, reservaEstadoCambiado, bienvenida, verificar };
