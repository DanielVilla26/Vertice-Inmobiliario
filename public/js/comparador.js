// ── Estado del comparador ──────────────────────────────────────────────────────
window.comparadorIds = new Set();
const MAX_COMPARAR = 3;

function toggleComparador(propId, titulo) {
  if (window.comparadorIds.has(propId)) {
    window.comparadorIds.delete(propId);
  } else {
    if (window.comparadorIds.size >= MAX_COMPARAR) {
      mostrarToast(`Máximo ${MAX_COMPARAR} propiedades a la vez`, "warning");
      return;
    }
    window.comparadorIds.add(propId);
  }
  actualizarBarraComparador();
}

function actualizarBarraComparador() {
  let barra = document.getElementById("barra-comparador");
  const count = window.comparadorIds.size;

  if (count === 0) {
    if (barra) barra.remove();
    return;
  }

  if (!barra) {
    barra = document.createElement("div");
    barra.id = "barra-comparador";
    barra.style.cssText = `
      position:fixed;bottom:0;left:0;right:0;z-index:300;
      background:#0f172a;color:white;padding:12px 24px;
      display:flex;align-items:center;justify-content:space-between;
      box-shadow:0 -4px 20px rgba(0,0,0,.3);flex-wrap:wrap;gap:10px;
    `;
    document.body.appendChild(barra);
  }

  barra.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;">
      <span style="font-size:14px;font-weight:bold;">🔍 Comparando ${count} de ${MAX_COMPARAR}</span>
      <div style="display:flex;gap:6px;">
        ${Array.from(window.comparadorIds).map(id => `
          <span style="background:#1e40af;padding:4px 10px;border-radius:20px;font-size:12px;">
            #${id}
            <button onclick="toggleComparador(${id})" style="background:none;border:none;color:white;cursor:pointer;margin-left:4px;font-size:14px;line-height:1;">×</button>
          </span>
        `).join("")}
      </div>
    </div>
    <div style="display:flex;gap:8px;">
      ${count >= 2 ? `<button onclick="abrirComparador()" style="padding:9px 20px;background:#3b82f6;border:none;color:white;border-radius:8px;font-size:14px;cursor:pointer;font-weight:bold;">Comparar →</button>` : `<span style="font-size:13px;color:#94a3b8;">Selecciona al menos 2</span>`}
      <button onclick="limpiarComparador()" style="padding:9px 14px;background:transparent;border:1px solid #334155;color:#94a3b8;border-radius:8px;font-size:13px;cursor:pointer;">Limpiar</button>
    </div>
  `;
}

function limpiarComparador() {
  window.comparadorIds.clear();
  actualizarBarraComparador();
}

async function abrirComparador() {
  const ids = Array.from(window.comparadorIds);
  const props = await Promise.all(ids.map(id => apiGet(`/api/propiedades/${id}`)));
  const imgsAll = await Promise.all(ids.map(id => apiGet(`/api/propiedades/${id}/imagenes`)));

  // Crear o encontrar overlay
  let overlay = document.getElementById("modal-comparador");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "modal-comparador";
    overlay.className = "modal-overlay";
    overlay.addEventListener("click", e => { if (e.target === overlay) overlay.classList.remove("active"); });
    document.body.appendChild(overlay);
  }

  const cols = props.map((p, i) => {
    const imgs = imgsAll[i].length > 0 ? imgsAll[i] : (p.imagen ? [{ url: p.imagen }] : []);
    const carId = `cmp_${p.id}`;
    const imgHtml = imgs.length > 0
      ? `<div style="height:180px;">${buildCarousel(imgs, "180px")}</div>`
      : `<div style="height:180px;background:#e2e8f0;display:flex;align-items:center;justify-content:center;color:#94a3b8;">Sin foto</div>`;

    return `
      <div style="flex:1;min-width:220px;background:white;border-radius:14px;overflow:hidden;border:1.5px solid #e2e8f0;">
        ${imgHtml}
        <div style="padding:16px;">
          <h3 style="font-size:15px;margin:0 0 12px;color:#0f172a;">${p.titulo}</h3>
          ${row("📍 Ciudad",       p.ciudad)}
          ${row("💰 Precio",       `$${Number(p.precio).toLocaleString()}/mes`)}
          ${row("🏠 Tipo",         capitalize(p.tipo || "apartamento"))}
          ${row("🛏 Habitaciones",  p.habitaciones || 1)}
          ${row("🚿 Baños",         p.banos || 1)}
          ${row("📐 Metros",        p.metros ? p.metros + " m²" : "N/D")}
          ${row("👥 Máx. personas", Number(p.max_personas) ? p.max_personas : "Sin límite")}
          ${row("🐾 Mascotas",      p.mascotas === 0 ? "No" : "Sí")}
          ${row("🚭 Fumar",         p.fumar === 0 ? "No" : "Sí")}
          ${row("🎉 Fiestas",       p.fiestas === 0 ? "No" : "Sí")}
          ${row("⭐ Calificación",   p.total_resenas ? `${Number(p.calificacion_promedio).toFixed(1)} ★ (${p.total_resenas})` : "Sin reseñas")}
          ${row("📞 Contacto",      p.contacto || "N/D")}
          <button class="modal-btn" style="margin-top:12px;" onclick="cerrarModal('modal-comparador');verDetalle(${p.id})">Ver detalles</button>
        </div>
      </div>
    `;
  }).join("");

  overlay.innerHTML = `
    <div style="background:#f5f7fb;border-radius:20px;padding:24px;max-width:95vw;width:${props.length * 280 + 80}px;max-height:90vh;overflow-y:auto;position:relative;animation:pop .22s ease;">
      <button class="close-btn close-btn-dark" onclick="cerrarModal('modal-comparador')" style="top:12px;right:16px;">×</button>
      <h2 style="font-size:18px;margin:0 0 18px;">🔍 Comparador de propiedades</h2>
      <div style="display:flex;gap:16px;flex-wrap:wrap;">${cols}</div>
    </div>
  `;
  overlay.classList.add("active");
}

function row(label, val) {
  return `
    <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">
      <span style="color:#64748b;">${label}</span>
      <span style="font-weight:bold;color:#0f172a;">${val}</span>
    </div>`;
}

function capitalize(str) {
  return str ? str[0].toUpperCase() + str.slice(1) : str;
}

// ── Toast notification ─────────────────────────────────────────────────────────
function mostrarToast(msg, tipo = "info") {
  const t = document.createElement("div");
  const bg = tipo === "warning" ? "#f59e0b" : tipo === "error" ? "#dc2626" : "#1e40af";
  t.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:${bg};color:white;padding:10px 22px;border-radius:10px;font-size:14px;z-index:400;animation:fadeIn .3s ease;box-shadow:0 4px 14px rgba(0,0,0,.2);`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}
