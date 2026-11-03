window.usuarioActual = null;
window.favoritosIds  = new Set();
window.comparadorIds = new Set();

// ── Modo oscuro persistente ────────────────────────────────────────────────────
(function() {
  if (localStorage.getItem("darkMode") === "1") document.body.classList.add("dark");
})();

function toggleDarkMode() {
  document.body.classList.toggle("dark");
  localStorage.setItem("darkMode", document.body.classList.contains("dark") ? "1" : "0");
  const btn = document.getElementById("dark-btn");
  if (btn) btn.textContent = document.body.classList.contains("dark") ? "☀️ Claro" : "🌙 Oscuro";
}

// ── Si una foto de propiedad no carga, se muestra una imagen de respaldo ───────
document.addEventListener("error", e => {
  const img = e.target;
  if (!img || img.tagName !== "IMG" || img.dataset.respaldo) return;
  if (!img.matches(".carousel img, .card img, .reserva-img, #img-existentes img")) return;
  img.dataset.respaldo = "1";
  img.src = "/img/sin-foto.svg";
}, true);

// ── Arranque ───────────────────────────────────────────────────────────────────
(async () => {
  const data = await apiGet("/api/auth/me");
  if (data.ok) {
    window.usuarioActual = data.usuario;
    if (data.usuario.rol !== "admin") await cargarFavIds();
    routeByRole();
  } else {
    renderAuth("login");
  }
})();

async function cargarFavIds() {
  const ids = await apiGet("/api/favoritos/ids");
  window.favoritosIds = new Set(ids);
}

function routeByRole() {
  const app = document.getElementById("app");
  app.innerHTML = `${renderNavbar()}<div id="main-content"></div>`;
  actualizarBadgeNotif();
  const main = document.getElementById("main-content");
  if (window.usuarioActual.rol === "admin") renderDashboardAdmin(main);
  else renderDashboardUsuario(main);
}

// ── Navbar ─────────────────────────────────────────────────────────────────────
function renderNavbar() {
  const u = window.usuarioActual;
  const esAdmin = u.rol === "admin";
  const avatarHtml = u.avatar
    ? `<img src="${u.avatar}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:2px solid #334155;">`
    : `<span style="width:28px;height:28px;border-radius:50%;background:#1e40af;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;color:white;">${esc(u.nombre[0].toUpperCase())}</span>`;

  return `
    <nav class="navbar">
      <span class="navbar-brand"><img class="navbar-logo" src="/img/logo-blanco.png" alt="Vértice Inmobiliario"></span>
      <button class="hamburger" id="hamburger" onclick="toggleMenu()" aria-label="Menú">
        <span></span><span></span><span></span>
      </button>
      <div class="nav-menu" id="nav-menu">
        ${esAdmin ? `
          <button class="btn-nav btn-nav-ghost" onclick="irDashboard();closeMenu()">Dashboard</button>
          <button class="btn-nav btn-nav-ghost" onclick="irPropiedades();closeMenu()">Propiedades</button>
          <button class="btn-nav btn-nav-ghost" onclick="irUsuarios();closeMenu()">👥 Usuarios</button>
          <button class="btn-nav btn-nav-ghost" onclick="irChat();closeMenu()">💬 Mensajes</button>
          <button class="btn-nav btn-nav-ghost" onclick="descargarReporte('excel')" title="Excel">📊 Excel</button>
          <button class="btn-nav btn-nav-ghost" onclick="descargarReporte('pdf')" title="PDF">📄 PDF</button>
        ` : `
          <button class="btn-nav btn-nav-ghost" onclick="irDashboard();closeMenu()">Mi espacio</button>
          <button class="btn-nav btn-nav-ghost" onclick="irPropiedades();closeMenu()">Propiedades</button>
          <button class="btn-nav btn-nav-ghost" onclick="irFavoritos();closeMenu()">❤️ Favoritos</button>
          <button class="btn-nav btn-nav-ghost" onclick="abrirChatUsuario(null,null);closeMenu()">💬 Chat</button>
        `}
        ${renderCampanaNavbar()}
        <button class="dark-toggle" id="dark-btn" onclick="toggleDarkMode()">
          ${document.body.classList.contains("dark") ? "☀️ Claro" : "🌙 Oscuro"}
        </button>
        <button class="btn-nav btn-nav-ghost" onclick="irPerfil();closeMenu()" style="display:flex;align-items:center;gap:6px;">
          ${avatarHtml} ${esc(u.nombre.split(" ")[0])}
        </button>
        <span class="navbar-role role-${u.rol}">${u.rol}</span>
        <button class="btn-nav btn-nav-ghost" onclick="logout()">Salir</button>
      </div>
    </nav>
  `;
}

function toggleMenu() {
  document.getElementById("hamburger")?.classList.toggle("open");
  document.getElementById("nav-menu")?.classList.toggle("open");
}
function closeMenu() {
  document.getElementById("hamburger")?.classList.remove("open");
  document.getElementById("nav-menu")?.classList.remove("open");
}

// ── Navegación ─────────────────────────────────────────────────────────────────
function getMain() { return document.getElementById("main-content"); }

function irDashboard() {
  document.getElementById("modal-editar-prop")?.remove();   // evita ids repetidos con el formulario del panel
  const m = getMain(); m.innerHTML = "";
  if (window.usuarioActual.rol === "admin") renderDashboardAdmin(m);
  else renderDashboardUsuario(m);
}
function irPropiedades() { const m = getMain(); m.innerHTML = ""; renderPropiedades(m); }
async function irFavoritos() { const m = getMain(); m.innerHTML = ""; await renderFavoritos(m); }
function irPerfil() { const m = getMain(); m.innerHTML = ""; renderPerfil(m); }
function irUsuarios() { const m = getMain(); m.innerHTML = ""; renderGestionUsuarios(m); }
function irChat() { const m = getMain(); m.innerHTML = ""; renderChatAdmin(m); }

function descargarReporte(tipo) {
  window.open(`/api/reportes/${tipo}`, "_blank");
}

// ── Logout ─────────────────────────────────────────────────────────────────────
async function logout() {
  await apiPost("/api/auth/logout", {});
  window.usuarioActual = null;
  window.favoritosIds  = new Set();
  window.comparadorIds = new Set();
  document.getElementById("barra-comparador")?.remove();
  if (chatSocket) { chatSocket.disconnect(); chatSocket = null; }
  renderAuth("login");
}
