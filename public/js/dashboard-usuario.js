// ── Dashboard Usuario / Inquilino ─────────────────────────────────────────────
async function renderDashboardUsuario(contenedor) {
  contenedor.innerHTML += `<div class="dashboard fade-in" id="dash-usuario"></div>`;
  await cargarDashUsuario();
}

async function cargarDashUsuario() {
  const dash    = document.getElementById("dash-usuario");
  const reservas = await apiGet("/api/reservas/mis");

  const pendientes  = reservas.filter(r => r.estado === "pendiente").length;
  const confirmadas = reservas.filter(r => r.estado === "confirmada").length;
  const canceladas  = reservas.filter(r => r.estado === "cancelada").length;

  dash.innerHTML = `
    <h2>Mi espacio</h2>

    <!-- Stats -->
    <div class="stats-grid" style="max-width:600px;">
      <div class="stat-card">
        <div class="stat-num">${reservas.length}</div>
        <div class="stat-label">Visitas agendadas</div>
      </div>
      <div class="stat-card">
        <div class="stat-num" style="color:#f59e0b;">${pendientes}</div>
        <div class="stat-label">Pendientes</div>
      </div>
      <div class="stat-card">
        <div class="stat-num" style="color:#10b981;">${confirmadas}</div>
        <div class="stat-label">Confirmadas</div>
      </div>
    </div>

    <!-- Acceso rápido -->
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:28px;">
      <button class="btn btn-primary" style="padding:10px 20px;" onclick="mostrarVistaPrincipal()">
        🏠 Ver propiedades
      </button>
      <button class="btn btn-warning" style="padding:10px 20px;" onclick="irFavoritos()">
        ❤️ Mis favoritos
      </button>
    </div>

    <!-- Mis reservas -->
    <p class="section-title">Mis visitas agendadas</p>
    <div id="mis-reservas-list">
      ${reservas.length === 0
        ? `<p style="color:#94a3b8;font-size:14px;">Aún no tienes visitas agendadas. <button class="link-btn" style="display:inline;color:#3b82f6;" onclick="mostrarVistaPrincipal()">Busca una propiedad aquí.</button></p>`
        : reservas.map(r => `
          <div class="reserva-card fade-in" id="rcard-${r.id}">
            <img class="reserva-img" src="${r.imagen || ''}" alt="${r.propiedad_titulo}">
            <div class="reserva-info">
              <h4>${r.propiedad_titulo}</h4>
              <p>📍 ${r.ciudad}</p>
              <p>📅 ${formatFecha(r.fecha)} a las ${r.hora}</p>
              ${r.nota ? `<p style="font-style:italic;color:#94a3b8;">"${esc(r.nota)}"</p>` : ""}
              <span class="badge badge-${r.estado}" style="margin-top:6px;">${r.estado}</span>
            </div>
            ${r.estado !== "cancelada" ? `
              <button class="btn-cancelar-reserva" onclick="cancelarMiReserva(${r.id})">Cancelar</button>
            ` : ""}
          </div>
        `).join("")
      }
    </div>
  `;
}

async function cancelarMiReserva(id) {
  if (!confirm("¿Cancelar esta visita?")) return;
  const data = await apiDelete(`/api/reservas/${id}`);
  if (data.ok) {
    const card = document.getElementById(`rcard-${id}`);
    if (card) {
      card.querySelector(".badge").className = "badge badge-cancelada";
      card.querySelector(".badge").textContent = "cancelada";
      card.querySelector(".btn-cancelar-reserva")?.remove();
    }
  }
}

function mostrarVistaPrincipal() {
  const dash = document.getElementById("dash-usuario");
  if (dash) dash.remove();

  let section = document.getElementById("vista-propiedades");
  if (!section) {
    const main = document.getElementById("main-content");
    main.innerHTML = "";
    renderPropiedades(main);
  }
}
