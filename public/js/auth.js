// ── Vista de autenticación ─────────────────────────────────────────────────────
function renderAuth(modo = "login") {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="auth-page">
      <!-- Fondo: foto fija -->
      <div class="auth-fondo" aria-hidden="true"></div>

      <div class="auth-contenido">
        <div class="auth-card fade-in">
          <img class="auth-logo" src="/img/logo.png" alt="Vértice Inmobiliario">
          <p class="sub">Alquileres modernos en Colombia</p>

          <div class="tabs" id="auth-tabs">
            <button class="tab-btn ${modo === "login"    ? "active" : ""}" onclick="renderAuth('login')">Iniciar sesión</button>
            <button class="tab-btn ${modo === "registro" ? "active" : ""}" onclick="renderAuth('registro')">Registrarse</button>
          </div>

          ${modo === "login"       ? formLogin()      : ""}
          ${modo === "registro"    ? formRegistro()   : ""}
          ${modo === "restablecer" ? formRestablecer() : ""}

          ${modo !== "restablecer" ? `<button class="link-btn" onclick="renderAuth('restablecer')">¿Olvidaste tu contraseña?</button>` : ""}
          ${modo === "restablecer" ? `<button class="link-btn" onclick="renderAuth('login')">← Volver al inicio de sesión</button>` : ""}
        </div>
      </div>
    </div>
  `;
}

// Iconos del botón de contraseña (SVG, sin emojis)
const ICONO_OJO = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`;
const ICONO_OJO_TACHADO = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.9 17.9A10.4 10.4 0 0 1 12 19C5.6 19 2 12 2 12a18.6 18.6 0 0 1 4.1-5.1M9.9 5.2A9.8 9.8 0 0 1 12 5c6.4 0 10 7 10 7a18.5 18.5 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`;

// Campo de contraseña con botón para mostrarla u ocultarla
function campoPassword(id, placeholder, alEnter = "") {
  return `<div class="pass-wrap">
    <input type="password" id="${id}" placeholder="${placeholder}" ${alEnter ? `onkeydown="if(event.key==='Enter')${alEnter}"` : ""}>
    <button type="button" class="pass-ojo" onclick="verPassword('${id}', this)" title="Mostrar u ocultar contraseña" aria-label="Mostrar u ocultar contraseña">${ICONO_OJO}</button>
  </div>`;
}
function verPassword(id, boton) {
  const input = document.getElementById(id);
  const mostrar = input.type === "password";
  input.type = mostrar ? "text" : "password";
  boton.innerHTML = mostrar ? ICONO_OJO_TACHADO : ICONO_OJO;
}

function formLogin() {
  return `
    <div id="form-login">
      <div class="form-grupo">
        <label>Email</label>
        <input type="email" id="l-email" placeholder="tu@email.com" onkeydown="if(event.key==='Enter')submitLogin()">
      </div>
      <div class="form-grupo">
        <label>Contraseña</label>
        ${campoPassword("l-pass", "••••••••", "submitLogin()")}
      </div>
      <p class="form-error" id="l-error"></p>
      <button class="btn-auth" onclick="submitLogin()">Entrar</button>
    </div>
  `;
}

function formRegistro() {
  return `
    <div id="form-registro">
      <div class="form-grupo">
        <label>Nombre completo</label>
        <input type="text" id="r-nombre" placeholder="Tu nombre">
      </div>
      <div class="form-grupo">
        <label>Email</label>
        <input type="email" id="r-email" placeholder="tu@email.com">
      </div>
      <div class="form-grupo">
        <label>Teléfono</label>
        <input type="tel" id="r-tel" placeholder="+57 300 000 0000">
      </div>
      <div class="form-grupo">
        <label>Contraseña</label>
        ${campoPassword("r-pass", "Mínimo 6 caracteres")}
      </div>
      <p class="form-error" id="r-error"></p>
      <p class="form-exito" id="r-exito"></p>
      <button class="btn-auth" onclick="submitRegistro()">Crear cuenta</button>
    </div>
  `;
}

function formRestablecer() {
  return `
    <div id="form-restablecer">
      <p style="font-size:13px;color:#64748b;margin-bottom:16px;text-align:center;">
        Ingresa tu email, el teléfono con el que te registraste y tu nueva contraseña.
      </p>
      <div class="form-grupo">
        <label>Email</label>
        <input type="email" id="rst-email" placeholder="tu@email.com">
      </div>
      <div class="form-grupo">
        <label>Teléfono registrado</label>
        <input type="tel" id="rst-tel" placeholder="+57 300 000 0000">
      </div>
      <div class="form-grupo">
        <label>Nueva contraseña</label>
        ${campoPassword("rst-pass", "Mínimo 6 caracteres")}
      </div>
      <p class="form-error" id="rst-error"></p>
      <p class="form-exito" id="rst-exito"></p>
      <button class="btn-auth" onclick="submitRestablecer()">Restablecer contraseña</button>
    </div>
  `;
}

async function submitLogin() {
  const email    = document.getElementById("l-email").value.trim();
  const password = document.getElementById("l-pass").value;
  const errEl    = document.getElementById("l-error");
  errEl.textContent = "";

  if (!email || !password) { errEl.textContent = "⚠️ Completa todos los campos."; return; }

  const data = await apiPost("/api/auth/login", { email, password });
  if (data.ok) {
    window.usuarioActual = data.usuario;
    routeByRole();
  } else {
    errEl.textContent = "❌ " + data.error;
  }
}

async function submitRegistro() {
  const nombre   = document.getElementById("r-nombre").value.trim();
  const email    = document.getElementById("r-email").value.trim();
  const telefono = document.getElementById("r-tel").value.trim();
  const password = document.getElementById("r-pass").value;
  const errEl    = document.getElementById("r-error");
  const okEl     = document.getElementById("r-exito");
  errEl.textContent = ""; okEl.textContent = "";

  if (!nombre || !email || !telefono || !password) { errEl.textContent = "⚠️ Completa todos los campos."; return; }

  const data = await apiPost("/api/auth/registro", { nombre, email, telefono, password });
  if (data.ok) {
    window.usuarioActual = data.usuario;
    routeByRole();
  } else {
    errEl.textContent = "❌ " + data.error;
  }
}

async function submitRestablecer() {
  const email          = document.getElementById("rst-email").value.trim();
  const telefono       = document.getElementById("rst-tel").value.trim();
  const nuevaPassword  = document.getElementById("rst-pass").value;
  const errEl          = document.getElementById("rst-error");
  const okEl           = document.getElementById("rst-exito");
  errEl.textContent = ""; okEl.textContent = "";

  if (!email || !telefono || !nuevaPassword) { errEl.textContent = "⚠️ Completa todos los campos."; return; }

  const data = await apiPost("/api/auth/restablecer", { email, telefono, nuevaPassword });
  if (data.ok) {
    okEl.textContent = "✅ " + data.mensaje + " Ya puedes iniciar sesión.";
    setTimeout(() => renderAuth("login"), 2000);
  } else {
    errEl.textContent = "❌ " + data.error;
  }
}

async function logout() {
  await apiPost("/api/auth/logout", {});
  window.usuarioActual = null;
  renderAuth("login");
}
