// ── Gestión de usuarios (admin) ───────────────────────────────────────────────
async function renderGestionUsuarios(contenedor) {
  contenedor.innerHTML += `<div class="dashboard fade-in" id="dash-usuarios"></div>`;
  await cargarUsuarios();
}

async function cargarUsuarios() {
  const usuarios = await apiGet("/api/usuarios");
  const dash = document.getElementById("dash-usuarios");
  if (!dash) return;

  const admins   = usuarios.filter(u => u.rol === "admin");
  const inquilinos = usuarios.filter(u => u.rol === "usuario");

  dash.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">
      <h2 style="margin:0;">👥 Gestión de usuarios</h2>
      <div style="display:flex;gap:8px;">
        <span style="background:#eff6ff;color:#1e40af;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:bold;">
          ${usuarios.length} total
        </span>
        <span style="background:#f0fdf4;color:#166534;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:bold;">
          ${inquilinos.filter(u=>u.activo!==0).length} activos
        </span>
        <span style="background:#fee2e2;color:#991b1b;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:bold;">
          ${usuarios.filter(u=>u.activo===0).length} inactivos
        </span>
      </div>
    </div>

    <!-- Buscador -->
    <div style="margin-bottom:16px;">
      <input type="text" id="busq-usuario" placeholder="🔍 Buscar por nombre o email..."
        oninput="filtrarTablaUsuarios()"
        style="padding:9px 14px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:14px;width:100%;max-width:360px;">
    </div>

    <div class="table-wrap">
      <table id="tabla-usuarios">
        <thead>
          <tr>
            <th>#</th>
            <th>Usuario</th>
            <th>Email</th>
            <th>Rol</th>
            <th>Estado</th>
            <th>Registro</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${usuarios.map(u => {
            const esYo = u.id === window.usuarioActual.id;
            const activo = u.activo !== 0;
            const fecha  = new Date(u.creado_en).toLocaleDateString("es-CO");
            return `
              <tr id="urow-${u.id}" data-nombre="${esc(u.nombre.toLowerCase())}" data-email="${esc(u.email.toLowerCase())}">
                <td>${u.id}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:8px;">
                    ${u.avatar
                      ? `<img src="${u.avatar}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">`
                      : `<div style="width:32px;height:32px;border-radius:50%;background:#dbeafe;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:bold;color:#1e40af;">${esc(u.nombre[0].toUpperCase())}</div>`}
                    <span style="font-weight:500;">${esc(u.nombre)}</span>
                  </div>
                </td>
                <td style="color:#64748b;font-size:13px;">${esc(u.email)}</td>
                <td>
                  <span class="badge ${u.rol === "admin" ? "badge-confirmada" : "badge-pendiente"}">${u.rol}</span>
                </td>
                <td>
                  <span class="badge ${activo ? "badge-confirmada" : "badge-cancelada"}">${activo ? "activo" : "inactivo"}</span>
                </td>
                <td style="font-size:13px;color:#64748b;">${fecha}</td>
                <td>
                  <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    ${!esYo ? `
                      <button class="btn btn-${activo ? "warning" : "success"}" style="padding:5px 10px;font-size:12px;"
                        onclick="toggleActivoUsuario(${u.id}, ${activo ? 0 : 1})">
                        ${activo ? "🚫 Desactivar" : "✅ Activar"}
                      </button>
                      <button class="btn btn-primary" style="padding:5px 10px;font-size:12px;"
                        onclick="abrirChatAdmin(${u.id}, ${esc(JSON.stringify(u.nombre))})">
                        💬 Chat
                      </button>
                    ` : `<span style="font-size:12px;color:#94a3b8;">Tú</span>`}
                  </div>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function toggleActivoUsuario(id, activo) {
  const accion = activo ? "activar" : "desactivar";
  if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} este usuario?`)) return;
  const data = await apiPut(`/api/usuarios/${id}/activo`, { activo });
  if (data.ok) await cargarUsuarios();
  else alert("Error: " + data.error);
}

function filtrarTablaUsuarios() {
  const q = document.getElementById("busq-usuario")?.value.toLowerCase() || "";
  document.querySelectorAll("#tabla-usuarios tbody tr").forEach(row => {
    const nombre = row.dataset.nombre || "";
    const email  = row.dataset.email  || "";
    row.style.display = (!q || nombre.includes(q) || email.includes(q)) ? "" : "none";
  });
}
