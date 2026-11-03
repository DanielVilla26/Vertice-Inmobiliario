// ── Carrusel helper ────────────────────────────────────────────────────────────
function buildCarousel(imagenes, altura = "200px") {
  if (!imagenes || imagenes.length === 0) {
    return `<div style="height:${altura};background:#e2e8f0;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:13px;">Sin imágenes</div>`;
  }
  const id = "car_" + Math.random().toString(36).slice(2);
  const dots = imagenes.map((_, i) => `<span class="${i===0?"active":""}" onclick="goSlide('${id}',${i})"></span>`).join("");
  const imgs = imagenes.map(img => `<img src="${img.url || img}" alt="foto" loading="lazy">`).join("");
  setTimeout(() => initCarousel(id), 0);
  return `
    <div class="carousel" id="${id}" style="height:${altura};" data-idx="0" data-total="${imagenes.length}">
      <div class="carousel-track">${imgs}</div>
      ${imagenes.length > 1 ? `
        <button class="carousel-btn prev" onclick="event.stopPropagation();stepCarousel('${id}',-1)">&#8249;</button>
        <button class="carousel-btn next" onclick="event.stopPropagation();stepCarousel('${id}',1)">&#8250;</button>
        <div class="carousel-dots">${dots}</div>
      ` : ""}
    </div>
  `;
}

function initCarousel(id) {
  const el = document.getElementById(id);
  if (el) el.dataset.idx = 0;
}

function stepCarousel(id, dir) {
  const el = document.getElementById(id);
  if (!el) return;
  let idx = parseInt(el.dataset.idx) + dir;
  const total = parseInt(el.dataset.total);
  if (idx < 0) idx = total - 1;
  if (idx >= total) idx = 0;
  goSlide(id, idx);
}

function goSlide(id, idx) {
  const el = document.getElementById(id);
  if (!el) return;
  el.dataset.idx = idx;
  el.querySelector(".carousel-track").style.transform = `translateX(-${idx * 100}%)`;
  el.querySelectorAll(".carousel-dots span").forEach((d, i) => d.classList.toggle("active", i === idx));
}

// ── Cache de imágenes ─────────────────────────────────────────────────────────
const imgCache = {};
async function getImagenes(propId) {
  if (imgCache[propId]) return imgCache[propId];
  const imgs = await apiGet(`/api/propiedades/${propId}/imagenes`);
  imgCache[propId] = imgs;
  return imgs;
}

// ── Vista principal ───────────────────────────────────────────────────────────
function renderPropiedades(contenedor) {
  contenedor.innerHTML += `
    <header class="hero">
      <h2>Encuentra tu hogar ideal</h2>
      <p>Alquileres modernos en Colombia</p>
    </header>

    <!-- Filtros básicos -->
    <section class="filtros">
      <div class="filtro-grupo">
        <label>Ciudad</label>
        <input type="text" id="f-ciudad" placeholder="Ej: Bogotá">
      </div>
      <div class="filtro-grupo">
        <label>Precio mínimo</label>
        <input type="number" id="f-pmin" placeholder="$ 0" step="100000">
      </div>
      <div class="filtro-grupo">
        <label>Precio máximo</label>
        <input type="number" id="f-pmax" placeholder="Sin límite" step="100000">
      </div>
      <button class="btn-filtrar" onclick="toggleFiltrosAvanzados()">⚙️ Avanzado</button>
      <button class="btn-filtrar" onclick="filtrarProps()">Buscar</button>
      <button class="btn-limpiar" onclick="limpiarProps()">Limpiar</button>
    </section>

    <!-- Filtros avanzados (ocultos por defecto) -->
    <section class="filtros" id="filtros-avanzados" style="display:none;background:#eff6ff;padding-top:14px;padding-bottom:14px;border-top:1px solid #bfdbfe;">
      <div class="filtro-grupo">
        <label>Tipo de inmueble</label>
        <select id="f-tipo" style="padding:8px 12px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:14px;background:white;">
          <option value="">Todos</option>
          <option value="apartamento">Apartamento</option>
          <option value="casa">Casa</option>
          <option value="estudio">Estudio</option>
          <option value="local">Local</option>
          <option value="finca">Finca</option>
        </select>
      </div>
      <div class="filtro-grupo">
        <label>Habitaciones mínimas</label>
        <select id="f-hab" style="padding:8px 12px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:14px;background:white;">
          <option value="">Cualquiera</option>
          <option value="1">1+</option>
          <option value="2">2+</option>
          <option value="3">3+</option>
          <option value="4">4+</option>
        </select>
      </div>
      <div class="filtro-grupo">
        <label>Baños mínimos</label>
        <select id="f-ban" style="padding:8px 12px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:14px;background:white;">
          <option value="">Cualquiera</option>
          <option value="1">1+</option>
          <option value="2">2+</option>
          <option value="3">3+</option>
        </select>
      </div>
      <div class="filtro-grupo">
        <label>Metros mínimos (m²)</label>
        <input type="number" id="f-metros" placeholder="Ej: 50" style="width:120px;">
      </div>
      <div class="filtro-grupo">
        <label>Personas que vivirían</label>
        <input type="number" id="f-personas" placeholder="Ej: 4" min="1" style="width:120px;">
      </div>
      <div class="filtro-grupo">
        <label>Mascotas</label>
        <select id="f-mascotas" style="padding:8px 12px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:14px;background:white;">
          <option value="">Da igual</option>
          <option value="1">Solo las que aceptan</option>
        </select>
      </div>
    </section>

    <p class="contador" id="prop-contador"></p>
    <section class="grid" id="prop-grid"></section>

    <!-- Modal detalle -->
    <div class="modal-overlay" id="modal-detalle">
      <div class="modal-box modal-2col" id="modal-detalle-content"></div>
    </div>
  `;
  cargarPropiedades();
}

function toggleFiltrosAvanzados() {
  const sec = document.getElementById("filtros-avanzados");
  if (!sec) return;
  sec.style.display = sec.style.display === "none" ? "flex" : "none";
}

async function cargarPropiedades(params = "") {
  const data = await apiGet("/api/propiedades" + (params ? "?" + params : ""));
  const grid = document.getElementById("prop-grid");
  const contador = document.getElementById("prop-contador");
  if (!grid) return;

  contador.textContent = data.length === 0
    ? "No se encontraron propiedades."
    : `${data.length} propiedad${data.length > 1 ? "es" : ""} encontrada${data.length > 1 ? "s" : ""}`;

  const esAdmin = window.usuarioActual?.rol === "admin";

  const tarjetasHtml = await Promise.all(data.map(async p => {
    const imgs = await getImagenes(p.id);
    const carrusel = imgs.length > 0
      ? buildCarousel(imgs, "200px")
      : buildCarousel(p.imagen ? [{ url: p.imagen }] : [], "200px");

    const esFav = window.favoritosIds?.has(p.id);
    const enComparador = window.comparadorIds?.has(p.id);

    return `
      <div class="card fade-in">
        <div class="img-container" style="height:200px;overflow:hidden;position:relative;">
          ${carrusel}
          <span class="city-badge">📍 ${p.ciudad}</span>
          ${!esAdmin ? `
            <button class="fav-btn ${esFav ? "activo" : ""}" id="fav-${p.id}"
              onclick="event.stopPropagation();toggleFav(${p.id})"
              title="${esFav ? "Quitar de favoritos" : "Guardar en favoritos"}">
              ${esFav ? "❤️" : "🤍"}
            </button>
          ` : ""}
        </div>
        <div class="card-body">
          <div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
            <span style="background:#eff6ff;color:#1e40af;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:bold;">${capitalize(p.tipo || "apartamento")}</span>
            <span style="background:#f0fdf4;color:#166534;font-size:11px;padding:2px 8px;border-radius:10px;">🛏 ${p.habitaciones || 1}</span>
            <span style="background:#f0fdf4;color:#166534;font-size:11px;padding:2px 8px;border-radius:10px;">🚿 ${p.banos || 1}</span>
            ${p.metros ? `<span style="background:#fef9c3;color:#854d0e;font-size:11px;padding:2px 8px;border-radius:10px;">📐 ${p.metros}m²</span>` : ""}
          </div>
          <h3>${p.titulo}</h3>
          ${reglasHtml(p, true)}
          <div class="card-rating" id="rating-${p.id}">${resumenCalificacion(p)}</div>
          <p class="price">$ ${Number(p.precio).toLocaleString()}/mes</p>
          <div class="card-actions">
            <button class="btn btn-primary" onclick="verDetalle(${p.id})">Ver detalles</button>
            ${!esAdmin ? `
              <button class="btn ${enComparador ? "btn-warning" : "btn-limpiar"}" style="padding:9px 10px;font-size:12px;"
                id="cmp-btn-${p.id}" onclick="toggleComparadorBtn(${p.id}, '${p.titulo.replace(/'/g,"\\'")}')">
                ${enComparador ? "✓ Comp." : "+ Comp."}
              </button>
            ` : `
              <button class="btn btn-warning" style="padding:9px 10px;" onclick="editarPropAdmin(${p.id})">✏️</button>
              <button class="btn btn-danger"  style="padding:9px 10px;" onclick="eliminarProp(${p.id})">🗑️</button>
            `}
          </div>
        </div>
      </div>
    `;
  }));

  grid.innerHTML = tarjetasHtml.join("");
}

function toggleComparadorBtn(propId, titulo) {
  toggleComparador(propId, titulo);
  const btn = document.getElementById(`cmp-btn-${propId}`);
  if (!btn) return;
  const enComparador = window.comparadorIds?.has(propId);
  btn.className = `btn ${enComparador ? "btn-warning" : "btn-limpiar"}`;
  btn.style.padding = "9px 10px";
  btn.style.fontSize = "12px";
  btn.textContent = enComparador ? "✓ Comp." : "+ Comp.";
}

// Restricciones de la propiedad → etiquetas. compacto=true para la tarjeta.
function reglasHtml(p, compacto = true) {
  const max = Number(p.max_personas) || 0;
  const items = [
    max ? `<span class="regla">👥 Máx. ${max} persona${max > 1 ? "s" : ""}</span>` : `<span class="regla">👥 Sin límite de personas</span>`,
    p.mascotas === 0 ? `<span class="regla no">🐾 No mascotas</span>` : `<span class="regla si">🐾 Acepta mascotas</span>`,
    p.fumar === 0    ? `<span class="regla no">🚭 No fumar</span>`    : `<span class="regla si">🚬 Se permite fumar</span>`,
    p.fiestas === 0  ? `<span class="regla no">🎉 No fiestas</span>`   : `<span class="regla si">🎉 Se permiten eventos</span>`
  ];
  // En la tarjeta solo se muestran las que restringen algo (para no recargarla)
  const lista = compacto
    ? items.filter(h => h.includes('class="regla no"') || h.includes("Máx."))
    : items;
  if (!lista.length) return "";
  return `<div class="${compacto ? "reglas" : "reglas-detalle"}">${lista.join("")}</div>`;
}

function capitalize(str) {
  return str ? str[0].toUpperCase() + str.slice(1) : str;
}

async function verDetalle(id) {
  const p    = await apiGet(`/api/propiedades/${id}`);
  const imgs = await getImagenes(id);
  const overlay = document.getElementById("modal-detalle");
  const content = document.getElementById("modal-detalle-content");
  if (!overlay || !content) return;

  const esAdmin = window.usuarioActual?.rol === "admin";
  const esFav   = window.favoritosIds?.has(id);
  const imagenesCar = imgs.length > 0 ? imgs : (p.imagen ? [{ url: p.imagen }] : []);

  content.innerHTML = `
    <div class="modal-left">
      ${buildCarousel(imagenesCar, "100%")}
    </div>
    <div class="modal-right">
      <button class="close-btn close-btn-dark" onclick="cerrarModal('modal-detalle')">×</button>
      <span style="background:#eff6ff;color:#1e40af;font-size:12px;padding:3px 10px;border-radius:10px;font-weight:bold;">${capitalize(p.tipo || "apartamento")}</span>
      <h2 style="font-size:20px;margin:10px 0 4px;">${p.titulo}</h2>
      <p class="meta">📍 ${p.ciudad}${p.direccion ? " — " + p.direccion : ""}</p>
      <p class="price-modal" style="font-size:22px;margin:10px 0;">
        $ ${Number(p.precio).toLocaleString()}
        <span style="font-size:14px;font-weight:normal;color:#64748b;">/mes</span>
      </p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin:10px 0;">
        <span style="background:#f0fdf4;color:#166534;font-size:13px;padding:4px 12px;border-radius:10px;">🛏 ${p.habitaciones || 1} hab.</span>
        <span style="background:#f0fdf4;color:#166534;font-size:13px;padding:4px 12px;border-radius:10px;">🚿 ${p.banos || 1} baños</span>
        ${p.metros ? `<span style="background:#fef9c3;color:#854d0e;font-size:13px;padding:4px 12px;border-radius:10px;">📐 ${p.metros} m²</span>` : ""}
      </div>
      <p class="meta">🟢 Disponible &nbsp;|&nbsp; 📞 ${p.contacto}</p>
      ${p.descripcion ? `<p class="meta" style="margin-top:10px;line-height:1.6;">${p.descripcion}</p>` : ""}
      <div class="detalle-seccion" style="margin-top:12px;">
        <h3 class="seccion-titulo">📋 Reglas de la propiedad</h3>
        ${reglasHtml(p, false)}
      </div>
      <div style="margin-top:16px;display:flex;flex-direction:column;gap:10px;">
        ${!esAdmin ? `
          <button class="modal-btn" onclick="abrirReserva(${p.id}, '${p.titulo.replace(/'/g,"\\'")}')">📅 Agendar visita</button>
          <button class="modal-btn" id="fav-modal-btn-${p.id}"
            style="background:${esFav ? "linear-gradient(135deg,#dc2626,#b91c1c)" : "linear-gradient(135deg,#f59e0b,#d97706)"};"
            onclick="toggleFavModal(${p.id}, this)">
            ${esFav ? "❤️ Quitar de favoritos" : "🤍 Guardar en favoritos"}
          </button>
        ` : `
          <button class="modal-btn" onclick="cerrarModal('modal-detalle');editarPropAdmin(${p.id})">✏️ Editar propiedad</button>
        `}
      </div>
      <div class="detalle-seccion">
        <h3 class="seccion-titulo">📍 Ubicación</h3>
        <div id="mapa-detalle" class="mapa-box"></div>
        <p class="mapa-nota" id="mapa-nota"></p>
      </div>
      <div class="detalle-seccion" id="resenas-box"></div>
    </div>
  `;
  overlay.classList.add("active");
  mostrarMapaDetalle(p).catch(() => {});
  cargarResenas(p.id).catch(() => {});
}

async function toggleFav(propId) {
  if (!window.usuarioActual) return;
  const data = await apiPost(`/api/favoritos/${propId}`, {});
  if (!data.ok) return;
  const btn = document.getElementById(`fav-${propId}`);
  if (data.favorito) {
    window.favoritosIds.add(propId);
    if (btn) { btn.textContent = "❤️"; btn.classList.add("activo"); }
    mostrarToast("Guardado en favoritos ❤️", "info");
  } else {
    window.favoritosIds.delete(propId);
    if (btn) { btn.textContent = "🤍"; btn.classList.remove("activo"); }
    mostrarToast("Eliminado de favoritos", "info");
  }
}

async function toggleFavModal(propId, btn) {
  const data = await apiPost(`/api/favoritos/${propId}`, {});
  if (!data.ok) return;
  if (data.favorito) {
    window.favoritosIds.add(propId);
    btn.textContent = "❤️ Quitar de favoritos";
    btn.style.background = "linear-gradient(135deg,#dc2626,#b91c1c)";
    const cardBtn = document.getElementById(`fav-${propId}`);
    if (cardBtn) { cardBtn.textContent = "❤️"; cardBtn.classList.add("activo"); }
  } else {
    window.favoritosIds.delete(propId);
    btn.textContent = "🤍 Guardar en favoritos";
    btn.style.background = "linear-gradient(135deg,#f59e0b,#d97706)";
    const cardBtn = document.getElementById(`fav-${propId}`);
    if (cardBtn) { cardBtn.textContent = "🤍"; cardBtn.classList.remove("activo"); }
  }
}

async function renderFavoritos(contenedor) {
  const favs = await apiGet("/api/favoritos");
  contenedor.innerHTML = `
    <div class="dashboard fade-in">
      <h2>❤️ Mis favoritos</h2>
      ${favs.length === 0
        ? `<p style="color:#94a3b8;">Aún no has guardado propiedades.
             <button class="link-btn" style="display:inline;color:#3b82f6;" onclick="irPropiedades()">Explorar propiedades</button>
           </p>`
        : `<div class="fav-grid">
            ${favs.map(p => `
              <div class="fav-card fade-in">
                <img src="${p.imagen || ''}" alt="${p.titulo}">
                <div class="fav-card-body">
                  <h4>${p.titulo}</h4>
                  <p>📍 ${p.ciudad}</p>
                  <p style="color:#1e40af;font-weight:bold;">$ ${Number(p.precio).toLocaleString()}/mes</p>
                </div>
                <button class="btn-ver-fav" onclick="verDetalleFav(${p.id})">Ver detalles →</button>
              </div>
            `).join("")}
           </div>`
      }
    </div>
    <div class="modal-overlay" id="modal-detalle">
      <div class="modal-box modal-2col" id="modal-detalle-content"></div>
    </div>
  `;
}

async function verDetalleFav(id) {
  await verDetalle(id);
}

function filtrarProps() {
  const ciudad  = document.getElementById("f-ciudad")?.value.trim();
  const pmin    = document.getElementById("f-pmin")?.value.trim();
  const pmax    = document.getElementById("f-pmax")?.value.trim();
  const tipo    = document.getElementById("f-tipo")?.value;
  const hab     = document.getElementById("f-hab")?.value;
  const ban     = document.getElementById("f-ban")?.value;
  const metros  = document.getElementById("f-metros")?.value.trim();

  const params = new URLSearchParams();
  if (ciudad) params.append("ciudad", ciudad);
  if (pmin)   params.append("precioMin", pmin);
  if (pmax)   params.append("precioMax", pmax);
  if (tipo)   params.append("tipo", tipo);
  if (hab)    params.append("habitaciones", hab);
  if (ban)    params.append("banos", ban);
  if (metros) params.append("metrosMin", metros);
  const personas = document.getElementById("f-personas")?.value.trim();
  const mascotas = document.getElementById("f-mascotas")?.value;
  if (personas) params.append("personas", personas);
  if (mascotas) params.append("mascotas", mascotas);
  cargarPropiedades(params.toString());
}

function limpiarProps() {
  ["f-ciudad","f-pmin","f-pmax","f-metros","f-personas"].forEach(id => { const el=document.getElementById(id); if(el) el.value=""; });
  ["f-tipo","f-hab","f-ban","f-mascotas"].forEach(id => { const el=document.getElementById(id); if(el) el.value=""; });
  cargarPropiedades();
}

async function eliminarProp(id) {
  if (!confirm("¿Eliminar esta propiedad?")) return;
  const data = await apiDelete(`/api/propiedades/${id}`);
  if (data.ok) cargarPropiedades();
}

function cerrarModal(id) {
  document.getElementById(id)?.classList.remove("active");
}

document.addEventListener("click", e => {
  document.querySelectorAll(".modal-overlay.active").forEach(m => {
    if (e.target === m) m.classList.remove("active");
  });
});
