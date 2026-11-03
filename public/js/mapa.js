// ── Mapas (Leaflet + OpenStreetMap, gratis y sin clave) ────────────────────────
// Se usan en dos lugares:
//   1) Detalle de una propiedad: muestra dónde queda.
//   2) Formulario del admin: se marca la ubicación con un clic o buscando la dirección.

const MAPA_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const MAPA_ATRIBUCION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

// ── Buscar coordenadas a partir de una dirección (Nominatim / OpenStreetMap) ──
const geoCache = {};
async function geocodificar(consulta) {
  if (!consulta) return null;
  if (consulta in geoCache) return geoCache[consulta];
  try {
    const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=co&q="
              + encodeURIComponent(consulta);
    const res  = await fetch(url, { headers: { "Accept-Language": "es" } });
    const data = await res.json();
    geoCache[consulta] = data.length ? { lat: Number(data[0].lat), lng: Number(data[0].lon) } : null;
    return geoCache[consulta];
  } catch {
    return null;      // sin internet: no se guarda en caché para poder reintentar
  }
}

// Intenta con la dirección completa y, si no la encuentra, con solo la ciudad
async function ubicarPropiedad(direccion, ciudad) {
  let g = null;
  if (direccion) g = await geocodificar([direccion, ciudad, "Colombia"].filter(Boolean).join(", "));
  if (g) return { ...g, aproximada: false };
  if (ciudad) g = await geocodificar(`${ciudad}, Colombia`);
  return g ? { ...g, aproximada: true } : null;
}

function mapaNoDisponible(caja, texto) {
  caja.innerHTML = `<p class="mapa-aviso">${texto}</p>`;
}

// ════════════════════════════════════════════════════════════════════════════════
// 1) Mapa del detalle de propiedad
// ════════════════════════════════════════════════════════════════════════════════
let mapaDetalle = null;

async function mostrarMapaDetalle(p) {
  const caja = document.getElementById("mapa-detalle");
  const nota = document.getElementById("mapa-nota");
  if (!caja) return;

  if (mapaDetalle) { try { mapaDetalle.remove(); } catch {} mapaDetalle = null; }
  if (typeof L === "undefined") {
    mapaNoDisponible(caja, "🗺️ No se pudo cargar el mapa. Revisa tu conexión a internet.");
    return;
  }

  // Coordenadas guardadas por el admin; si no hay, se busca por la dirección
  let lat = p.latitud, lng = p.longitud, aproximada = false;
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    caja.innerHTML = `<p class="mapa-aviso">Buscando ubicación…</p>`;
    const g = await ubicarPropiedad(p.direccion, p.ciudad);
    if (!g) { mapaNoDisponible(caja, "📍 Ubicación no disponible para esta propiedad."); return; }
    lat = g.lat; lng = g.lng; aproximada = g.aproximada;
  }

  // Mientras se buscaba, el usuario pudo cerrar el modal o abrir otra propiedad
  if (!document.body.contains(caja)) return;

  caja.innerHTML = "";
  mapaDetalle = L.map(caja, { scrollWheelZoom: false }).setView([lat, lng], aproximada ? 13 : 16);
  L.tileLayer(MAPA_TILES, { maxZoom: 19, attribution: MAPA_ATRIBUCION }).addTo(mapaDetalle);
  L.marker([lat, lng]).addTo(mapaDetalle).bindPopup(esc(p.titulo));
  setTimeout(() => { if (mapaDetalle) mapaDetalle.invalidateSize(); }, 200);

  if (nota) {
    nota.innerHTML = (aproximada ? "Ubicación aproximada (según la ciudad). " : "")
      + `<a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener">Abrir en Google Maps ↗</a>`;
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// 2) Selector de ubicación en el formulario del admin
// ════════════════════════════════════════════════════════════════════════════════
let mapaAdmin = null;
let marcadorAdmin = null;

function iniciarMapaAdmin() {
  const caja = document.getElementById("mapa-admin");
  if (!caja) return;
  if (mapaAdmin) { try { mapaAdmin.remove(); } catch {} mapaAdmin = null; marcadorAdmin = null; }

  if (typeof L === "undefined") {
    mapaNoDisponible(caja, "🗺️ No se pudo cargar el mapa. Revisa tu conexión a internet.");
    return;
  }
  mapaAdmin = L.map(caja).setView([4.6, -74.1], 5);   // vista general de Colombia
  L.tileLayer(MAPA_TILES, { maxZoom: 19, attribution: MAPA_ATRIBUCION }).addTo(mapaAdmin);
  mapaAdmin.on("click", ev => colocarMarcadorAdmin(ev.latlng.lat, ev.latlng.lng));
  setTimeout(() => { if (mapaAdmin) mapaAdmin.invalidateSize(); }, 200);
}

function colocarMarcadorAdmin(lat, lng, centrar = false) {
  const inLat = document.getElementById("p-lat"), inLng = document.getElementById("p-lng");
  if (inLat) inLat.value = Number(lat).toFixed(6);
  if (inLng) inLng.value = Number(lng).toFixed(6);
  const txt = document.getElementById("mapa-admin-coords");
  if (txt) txt.textContent = `📌 ${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
  if (!mapaAdmin) return;

  if (!marcadorAdmin) {
    marcadorAdmin = L.marker([lat, lng], { draggable: true }).addTo(mapaAdmin);
    marcadorAdmin.on("dragend", () => {
      const c = marcadorAdmin.getLatLng();
      colocarMarcadorAdmin(c.lat, c.lng);
    });
  } else {
    marcadorAdmin.setLatLng([lat, lng]);
  }
  if (centrar) mapaAdmin.setView([lat, lng], 16);
}

function quitarMarcadorAdmin() {
  if (marcadorAdmin && mapaAdmin) mapaAdmin.removeLayer(marcadorAdmin);
  marcadorAdmin = null;
  const inLat = document.getElementById("p-lat"), inLng = document.getElementById("p-lng");
  if (inLat) inLat.value = "";
  if (inLng) inLng.value = "";
  const txt = document.getElementById("mapa-admin-coords");
  if (txt) txt.textContent = "Sin ubicación marcada";
}

async function buscarDireccionAdmin() {
  const dir    = document.getElementById("p-dir")?.value.trim() || "";
  const ciudad = document.getElementById("p-ciudad")?.value.trim() || "";
  const txt    = document.getElementById("mapa-admin-coords");
  const btn    = document.getElementById("btn-buscar-dir");
  if (!dir && !ciudad) { if (txt) txt.textContent = "⚠️ Escribe primero la ciudad o la dirección."; return; }

  if (btn) { btn.disabled = true; btn.textContent = "Buscando…"; }
  const g = await ubicarPropiedad(dir, ciudad);
  if (btn) { btn.disabled = false; btn.textContent = "🔎 Buscar la dirección"; }

  if (!g) { if (txt) txt.textContent = "❌ No la encontré. Haz clic en el mapa para marcarla."; return; }
  colocarMarcadorAdmin(g.lat, g.lng, true);
  if (g.aproximada && txt) txt.textContent += "  (aproximada: ajusta el marcador)";
}
