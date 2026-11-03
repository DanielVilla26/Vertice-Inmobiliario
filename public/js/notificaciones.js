// ── Notificaciones ────────────────────────────────────────────────────────────
async function actualizarBadgeNotif() {
  const data = await apiGet("/api/notificaciones/no-leidas");
  const badge = document.getElementById("notif-badge");
  if (!badge) return;
  if (data.count > 0) {
    badge.textContent = data.count > 9 ? "9+" : data.count;
    badge.style.display = "flex";
  } else {
    badge.style.display = "none";
  }
}

function renderCampanaNavbar() {
  return `
    <div style="position:relative;display:inline-block;">
      <button class="btn-nav btn-nav-ghost" onclick="toggleNotifPanel()" style="font-size:18px;padding:7px 10px;" title="Notificaciones">
        🔔
      </button>
      <span id="notif-badge" style="display:none;position:absolute;top:2px;right:2px;background:#dc2626;color:white;border-radius:10px;padding:1px 5px;font-size:10px;font-weight:bold;min-width:16px;justify-content:center;align-items:center;"></span>
    </div>
  `;
}

async function toggleNotifPanel() {
  let panel = document.getElementById("notif-panel");
  if (panel) { panel.remove(); return; }

  const notifs = await apiGet("/api/notificaciones");
  await apiPut("/api/notificaciones/leer-todas", {});
  actualizarBadgeNotif();

  panel = document.createElement("div");
  panel.id = "notif-panel";
  panel.style.cssText = `
    position:fixed;top:60px;right:16px;z-index:400;
    background:white;border-radius:14px;width:320px;max-height:420px;
    overflow-y:auto;box-shadow:0 10px 40px rgba(0,0,0,.18);
    border:1px solid #e2e8f0;animation:pop .2s ease;
  `;

  const iconos = { reserva: "📅", bienvenida: "🏠", chat: "💬", sistema: "⚙️" };

  panel.innerHTML = `
    <div style="padding:14px 16px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-weight:bold;font-size:15px;">🔔 Notificaciones</span>
      <button onclick="document.getElementById('notif-panel').remove()" style="background:none;border:none;color:#94a3b8;font-size:20px;cursor:pointer;">×</button>
    </div>
    ${notifs.length === 0
      ? `<p style="padding:20px;color:#94a3b8;font-size:14px;text-align:center;">Sin notificaciones</p>`
      : notifs.map(n => `
          <div style="padding:12px 16px;border-bottom:1px solid #f8fafc;${n.leida ? "" : "background:#eff6ff;"}">
            <div style="display:flex;gap:10px;align-items:flex-start;">
              <span style="font-size:18px;margin-top:1px;">${iconos[n.tipo] || "🔔"}</span>
              <div style="flex:1;">
                <p style="font-size:13px;font-weight:bold;margin:0 0 2px;color:#0f172a;">${esc(n.titulo)}</p>
                <p style="font-size:12px;color:#64748b;margin:0;line-height:1.5;">${esc(n.mensaje)}</p>
                <p style="font-size:11px;color:#94a3b8;margin:4px 0 0;">${new Date(n.creado_en).toLocaleString("es-CO")}</p>
              </div>
            </div>
          </div>
        `).join("")
    }
  `;

  document.body.appendChild(panel);

  // Cerrar al clic fuera
  setTimeout(() => {
    document.addEventListener("click", function handler(e) {
      if (!panel.contains(e.target) && e.target.id !== "notif-badge") {
        panel.remove();
        document.removeEventListener("click", handler);
      }
    });
  }, 100);
}
