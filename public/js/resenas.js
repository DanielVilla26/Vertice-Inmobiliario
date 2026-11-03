// ── Reseñas y calificaciones de propiedades ────────────────────────────────────

let resenaEstrellasSel = 0;

// Estrellas de solo lectura (valor de 0 a 5)
function estrellasHtml(valor, tam = 16) {
  const v = Math.round(Number(valor) || 0);
  let h = "";
  for (let i = 1; i <= 5; i++)
    h += `<span class="estrella ${i <= v ? "llena" : ""}" style="font-size:${tam}px;">★</span>`;
  return `<span class="estrellas" title="${v} de 5">${h}</span>`;
}

// Resumen corto para las tarjetas: ★★★★☆ 4.5 (3)
function resumenCalificacion(p) {
  const total = Number(p.total_resenas) || 0;
  if (!total) return `<span class="sin-resenas">Sin reseñas aún</span>`;
  return `${estrellasHtml(p.calificacion_promedio, 15)}
          <strong>${Number(p.calificacion_promedio).toFixed(1)}</strong>
          <span class="resenas-total">(${total})</span>`;
}

async function cargarResenas(propId) {
  const caja = document.getElementById("resenas-box");
  if (!caja) return;
  const data = await apiGet(`/api/propiedades/${propId}/resenas`);
  if (!data || !data.ok) { caja.innerHTML = `<p class="meta">No se pudieron cargar las reseñas.</p>`; return; }

  const yo      = window.usuarioActual;
  const esAdmin = yo?.rol === "admin";
  const mia     = yo ? data.resenas.find(r => r.usuario_id === yo.id) : null;
  resenaEstrellasSel = mia ? mia.calificacion : 0;

  const resumen = data.total
    ? `${estrellasHtml(data.promedio, 20)} <strong>${data.promedio.toFixed(1)}</strong>
       <span class="resenas-total">(${data.total} reseña${data.total > 1 ? "s" : ""})</span>`
    : `<span class="sin-resenas">Aún no hay reseñas. ${yo && !esAdmin ? "¡Sé la primera persona en opinar!" : ""}</span>`;

  let formulario = "";
  if (!yo) {
    formulario = `<p class="meta">Inicia sesión para dejar tu reseña.</p>`;
  } else if (!esAdmin) {
    formulario = `
      <div class="resena-form">
        <p class="meta" style="margin:0 0 6px;">${mia ? "Editar tu reseña" : "Deja tu reseña"}</p>
        <div class="estrellas-input" id="estrellas-input">
          ${[1, 2, 3, 4, 5].map(i =>
            `<button type="button" class="estrella-btn ${i <= resenaEstrellasSel ? "llena" : ""}" onclick="elegirEstrellas(${i})" title="${i} estrella${i > 1 ? "s" : ""}">★</button>`
          ).join("")}
        </div>
        <textarea id="resena-texto" rows="2" maxlength="500" placeholder="Cuenta tu experiencia (opcional)">${esc(mia?.comentario || "")}</textarea>
        <p class="form-error" id="resena-error"></p>
        <button class="modal-btn" onclick="enviarResena(${propId})">${mia ? "Actualizar reseña" : "Publicar reseña"}</button>
      </div>`;
  }

  const lista = data.resenas.map(r => `
    <div class="resena">
      <div class="resena-cab">
        <strong>${esc(r.nombre)}</strong>
        ${estrellasHtml(r.calificacion, 13)}
        <span class="resena-fecha">${esc((r.creado_en || "").slice(0, 10))}</span>
        ${(esAdmin || (yo && r.usuario_id === yo.id))
          ? `<button class="resena-borrar" title="Eliminar reseña" onclick="borrarResena(${r.id}, ${propId})">🗑️</button>` : ""}
      </div>
      ${r.comentario ? `<p class="resena-texto">${esc(r.comentario)}</p>` : ""}
    </div>`).join("");

  caja.innerHTML = `
    <h3 class="seccion-titulo">⭐ Reseñas</h3>
    <div class="resenas-resumen">${resumen}</div>
    ${formulario}
    <div class="resenas-lista">${lista}</div>`;
}

function elegirEstrellas(valor) {
  resenaEstrellasSel = valor;
  document.querySelectorAll("#estrellas-input .estrella-btn").forEach((b, i) => {
    b.classList.toggle("llena", i < valor);
  });
}

async function enviarResena(propId) {
  const errEl = document.getElementById("resena-error");
  if (!resenaEstrellasSel) { errEl.textContent = "⚠️ Elige de 1 a 5 estrellas."; return; }
  const comentario = document.getElementById("resena-texto").value.trim();
  const data = await apiPost(`/api/propiedades/${propId}/resenas`, { calificacion: resenaEstrellasSel, comentario });
  if (!data.ok) { errEl.textContent = "❌ " + data.error; return; }
  if (typeof mostrarToast === "function") mostrarToast(data.mensaje);
  await cargarResenas(propId);
  refrescarCalificacionTarjeta(propId);
}

async function borrarResena(id, propId) {
  if (!confirm("¿Eliminar esta reseña?")) return;
  const data = await apiDelete(`/api/resenas/${id}`);
  if (!data.ok) { alert(data.error || "No se pudo eliminar."); return; }
  await cargarResenas(propId);
  refrescarCalificacionTarjeta(propId);
}

// Actualiza las estrellas de la tarjeta del catálogo sin recargar toda la lista
async function refrescarCalificacionTarjeta(propId) {
  const el = document.getElementById(`rating-${propId}`);
  if (!el) return;
  const p = await apiGet(`/api/propiedades/${propId}`);
  if (p && p.id) el.innerHTML = resumenCalificacion(p);
}
