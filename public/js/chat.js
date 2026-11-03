// ── Chat en tiempo real ───────────────────────────────────────────────────────
let chatSocket     = null;
let chatUsuarioId  = null;   // con quién estoy chateando (admin: id del usuario, usuario: null)
let chatPropId     = null;

function initSocket() {
  if (chatSocket) return;
  chatSocket = io();

  chatSocket.on("chat:mensaje", (msg) => {
    // Si el panel de chat está abierto y corresponde a esta conversación
    const panel = document.getElementById("chat-panel");
    const msgs  = document.getElementById("chat-mensajes");
    if (panel && msgs) {
      const uid = window.usuarioActual.rol === "admin" ? chatUsuarioId : window.usuarioActual.id;
      if (Number(msg.usuario_id) === Number(uid)) {
        agregarBurbuja(msgs, msg);
        msgs.scrollTop = msgs.scrollHeight;
      }
    }
    // Badge de no leídos
    actualizarBadgeChat();
  });

  chatSocket.on("chat:nuevo", ({ uid, nombre, prop }) => {
    actualizarBadgeChat();
    mostrarToast(`💬 Nuevo mensaje de ${nombre}${prop ? ` sobre "${prop}"` : ""}`, "info");
    // Refrescar lista de conversaciones si está abierta
    if (document.getElementById("chat-convs-list")) cargarConversaciones();
  });

  chatSocket.on("nueva_notif", (n) => {
    actualizarBadgeNotif();
    mostrarToast(`🔔 ${n.titulo}: ${n.mensaje}`, "info");
    if (document.getElementById("notif-panel")) cargarNotificaciones();
  });
}

// ── Panel chat usuario ────────────────────────────────────────────────────────
function abrirChatUsuario(propId, propTitulo) {
  chatPropId = propId || null;
  chatUsuarioId = null;
  mostrarPanelChat(`💬 Chat con soporte${propTitulo ? ` — ${propTitulo}` : ""}`, window.usuarioActual.id);
}

// ── Panel chat admin (con un usuario específico) ──────────────────────────────
function abrirChatAdmin(usuarioId, usuarioNombre) {
  chatUsuarioId = usuarioId;
  mostrarPanelChat(`💬 Chat con ${usuarioNombre}`, usuarioId);
}

async function mostrarPanelChat(titulo, uid) {
  initSocket();

  let overlay = document.getElementById("chat-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "chat-overlay";
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:500;display:flex;align-items:flex-end;justify-content:flex-end;padding:20px;";
    overlay.addEventListener("click", e => { if (e.target === overlay) cerrarChat(); });
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div id="chat-panel" style="width:360px;height:520px;background:white;border-radius:16px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3);animation:pop .2s ease;">
      <div style="background:#1e40af;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;">
        <span style="color:white;font-weight:bold;font-size:14px;">${esc(titulo)}</span>
        <button onclick="cerrarChat()" style="background:none;border:none;color:white;font-size:20px;cursor:pointer;line-height:1;">×</button>
      </div>
      <div id="chat-mensajes" style="flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:#f8fafc;"></div>
      <div style="padding:10px;border-top:1px solid #e2e8f0;display:flex;gap:8px;">
        <input id="chat-input" type="text" placeholder="Escribe un mensaje..."
          style="flex:1;padding:9px 12px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:14px;"
          onkeydown="if(event.key==='Enter')enviarMensajeChat()">
        <button onclick="enviarMensajeChat()" style="padding:9px 14px;background:#1e40af;color:white;border:none;border-radius:8px;font-size:18px;cursor:pointer;">↑</button>
      </div>
    </div>
  `;

  // Cargar historial
  const msgs = await apiGet(`/api/chat/${uid}`);
  const cont = document.getElementById("chat-mensajes");
  msgs.forEach(m => agregarBurbuja(cont, m));
  cont.scrollTop = cont.scrollHeight;

  document.getElementById("chat-input").focus();
}

function agregarBurbuja(cont, msg) {
  const esPropio = window.usuarioActual.rol === "admin" ? msg.de_admin === 1 : msg.de_admin === 0;
  const div = document.createElement("div");
  div.style.cssText = `display:flex;flex-direction:column;align-items:${esPropio ? "flex-end" : "flex-start"};`;
  const hora = new Date(msg.creado_en).toLocaleTimeString("es-CO", { hour:"2-digit", minute:"2-digit" });
  div.innerHTML = `
    <div style="max-width:75%;padding:9px 12px;border-radius:${esPropio ? "14px 14px 4px 14px" : "14px 14px 14px 4px"};background:${esPropio ? "#1e40af" : "white"};color:${esPropio ? "white" : "#0f172a"};font-size:13px;box-shadow:0 1px 4px rgba(0,0,0,.1);">
      ${esc(msg.mensaje)}
    </div>
    <span style="font-size:10px;color:#94a3b8;margin-top:2px;">${hora}</span>
  `;
  cont.appendChild(div);
}

function enviarMensajeChat() {
  const input = document.getElementById("chat-input");
  const msg   = input?.value.trim();
  if (!msg) return;
  const esAdmin = window.usuarioActual.rol === "admin";
  chatSocket.emit("chat:enviar", {
    destinatarioId: esAdmin ? chatUsuarioId : null,
    mensaje: msg,
    propiedadId: chatPropId
  });
  input.value = "";
}

function cerrarChat() {
  document.getElementById("chat-overlay")?.remove();
}

async function actualizarBadgeChat() {
  // Sin endpoint propio — refrescamos el badge de notificaciones general
  actualizarBadgeNotif();
}

// ── Vista de conversaciones (admin) ───────────────────────────────────────────
async function renderChatAdmin(contenedor) {
  initSocket();
  contenedor.innerHTML += `
    <div class="dashboard fade-in">
      <h2>💬 Mensajes</h2>
      <div id="chat-convs-list"></div>
    </div>`;
  await cargarConversaciones();
}

async function cargarConversaciones() {
  const convs = await apiGet("/api/chat/conversaciones/lista");
  const cont  = document.getElementById("chat-convs-list");
  if (!cont) return;

  if (!convs.length) {
    cont.innerHTML = `<p style="color:#94a3b8;font-size:14px;">Aún no hay conversaciones.</p>`;
    return;
  }

  cont.innerHTML = convs.map(c => `
    <div onclick="abrirChatAdmin(${c.id},${esc(JSON.stringify(c.nombre))}) "
      style="display:flex;align-items:center;gap:12px;padding:14px;background:white;border-radius:12px;margin-bottom:10px;cursor:pointer;border:1.5px solid ${c.no_leidos > 0 ? "#3b82f6" : "#e2e8f0"};box-shadow:0 2px 8px rgba(0,0,0,.06);transition:.2s;"
      onmouseover="this.style.borderColor='#3b82f6'" onmouseout="this.style.borderColor='${c.no_leidos > 0 ? "#3b82f6" : "#e2e8f0"}'">
      <div style="width:44px;height:44px;border-radius:50%;background:#dbeafe;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:bold;color:#1e40af;flex-shrink:0;">
        ${esc(c.nombre[0].toUpperCase())}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:bold;font-size:14px;">${esc(c.nombre)}</span>
          ${c.no_leidos > 0 ? `<span style="background:#3b82f6;color:white;border-radius:10px;padding:2px 7px;font-size:11px;font-weight:bold;">${c.no_leidos}</span>` : ""}
        </div>
        <p style="font-size:12px;color:#64748b;margin:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(c.ultimo_msg || "Sin mensajes")}</p>
        <p style="font-size:11px;color:#94a3b8;margin:0;">${esc(c.email)}</p>
      </div>
    </div>
  `).join("");
}
