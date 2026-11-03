// ── Resumen de actividad del admin (últimos 6 meses) ───────────────────────────
// Se dibuja todo con HTML y SVG simples: no necesita librerías de gráficas.

const SERIES_ACTIVIDAD = [
  { clave: "usuarios",    nombre: "Usuarios",    color: "#2563eb" },
  { clave: "propiedades", nombre: "Propiedades", color: "#10b981" },
  { clave: "reservas",    nombre: "Reservas",    color: "#f59e0b" }
];

// Gráfica de barras agrupadas: una barra por serie y por mes
function graficaActividadSvg(meses) {
  const W = 640, H = 300, mIzq = 40, mDer = 12, mSup = 18, mInf = 38;
  const plotW = W - mIzq - mDer, plotH = H - mSup - mInf;

  const maxVal = Math.max(1, ...meses.flatMap(m => SERIES_ACTIVIDAD.map(s => m[s.clave])));
  const paso   = Math.max(1, Math.ceil(maxVal / 4));   // 4 divisiones en el eje vertical
  const yMax   = paso * 4;

  const grupoW = plotW / meses.length;
  const barW   = Math.min(22, grupoW / 4);
  const sep    = 4;
  const totalW = barW * SERIES_ACTIVIDAD.length + sep * (SERIES_ACTIVIDAD.length - 1);

  let rejilla = "", barras = "", etiquetas = "";

  for (let k = 0; k <= 4; k++) {
    const y = mSup + plotH - (k * paso / yMax) * plotH;
    rejilla += `<line class="grafica-rejilla" x1="${mIzq}" x2="${W - mDer}" y1="${y}" y2="${y}"/>
                <text class="grafica-eje" x="${mIzq - 8}" y="${y + 4}" text-anchor="end">${k * paso}</text>`;
  }

  meses.forEach((m, i) => {
    const x0 = mIzq + i * grupoW + (grupoW - totalW) / 2;
    SERIES_ACTIVIDAD.forEach((s, j) => {
      const v = m[s.clave];
      if (!v) return;                                    // sin registros: no se dibuja barra
      const h = Math.max(3, (v / yMax) * plotH);
      const x = x0 + j * (barW + sep);
      const y = mSup + plotH - h;
      barras += `<rect class="grafica-barra" x="${x}" y="${y}" width="${barW}" height="${h}" rx="3" fill="${s.color}">
                   <title>${esc(m.etiqueta)} · ${s.nombre}: ${v}</title></rect>
                 <text class="grafica-valor" x="${x + barW / 2}" y="${y - 4}" text-anchor="middle">${v}</text>`;
    });
    etiquetas += `<text class="grafica-eje" x="${mIzq + i * grupoW + grupoW / 2}" y="${H - 14}" text-anchor="middle">${esc(m.etiqueta)}</text>`;
  });

  return `<svg class="grafica-svg" viewBox="0 0 ${W} ${H}" role="img"
               aria-label="Registros nuevos por mes en los últimos 6 meses">${rejilla}${barras}${etiquetas}</svg>`;
}

function tarjetaResumen(icono, numero, etiqueta) {
  return `<div class="resumen-card">
    <span class="resumen-icono">${icono}</span>
    <div class="resumen-num">${numero}</div>
    <div class="resumen-label">${etiqueta}</div>
  </div>`;
}

function listaMasGuardadas(items) {
  if (!items.length) return `<p class="resumen-vacio">Todavía no hay favoritos registrados.</p>`;
  const max = Math.max(...items.map(i => i.total));
  return `<ol class="rank-lista">${items.map((p, i) => `
    <li>
      <span class="rank-pos">${i + 1}</span>
      <div class="rank-info">
        <strong>${esc(p.titulo)}</strong>
        <small>${esc(p.ciudad)}</small>
        <div class="rank-barra"><i style="width:${Math.round(p.total / max * 100)}%"></i></div>
      </div>
      <span class="rank-valor">♥ ${p.total}</span>
    </li>`).join("")}</ol>`;
}

function listaMejorValoradas(items) {
  if (!items.length) return `<p class="resumen-vacio">Todavía no hay reseñas.</p>`;
  return `<ol class="rank-lista">${items.map((p, i) => `
    <li>
      <span class="rank-pos">${i + 1}</span>
      <div class="rank-info">
        <strong>${esc(p.titulo)}</strong>
        <small>${esc(p.ciudad)}</small>
      </div>
      <span class="rank-valor rank-estrellas">
        ${estrellasHtml(p.promedio, 16)}
        <b>${Number(p.promedio).toFixed(1)}</b>
        <small>(${p.total} reseña${p.total > 1 ? "s" : ""})</small>
      </span>
    </li>`).join("")}</ol>`;
}

// HTML completo de la sección «Resumen de actividad»
function resumenActividadHtml(act) {
  if (!act || !act.ok) return "";
  const t = act.tarjetas;
  const hayDatos = act.meses.some(m => m.usuarios || m.propiedades || m.reservas);

  return `
  <section class="resumen">
    <div class="resumen-cab">
      <div>
        <h2>Resumen de actividad</h2>
        <p class="resumen-sub">Indicadores generales de Vértice Inmobiliario</p>
      </div>
      <span class="resumen-nota">Actualizado al cargar el panel</span>
    </div>

    <div class="resumen-cards">
      ${tarjetaResumen("✔", t.reservasConfirmadas, "Reservas confirmadas")}
      ${tarjetaResumen("♡", t.favoritosGuardados, "Favoritos guardados")}
      ${tarjetaResumen("★", `${Number(t.promedioResenas).toFixed(1)} <small>/ 5</small>`, `Promedio de reseñas (${t.totalResenas})`)}
      ${tarjetaResumen("↘", t.reservasCanceladas, "Reservas canceladas")}
    </div>

    <div class="resumen-paneles">
      <div class="resumen-panel">
        <h3>Actividad de los últimos 6 meses</h3>
        <p class="resumen-sub">Registros nuevos por mes</p>
        <div class="grafica-leyenda">
          ${SERIES_ACTIVIDAD.map(s => `<span><i style="background:${s.color}"></i>${s.nombre}</span>`).join("")}
        </div>
        ${graficaActividadSvg(act.meses)}
        ${hayDatos ? "" : `<p class="resumen-vacio">Todavía no hay registros en estos 6 meses.</p>`}
      </div>

      <div class="resumen-panel">
        <h3>Propiedades más guardadas</h3>
        <p class="resumen-sub">Según los favoritos de los usuarios</p>
        ${listaMasGuardadas(act.masGuardadas)}
      </div>
    </div>

    <div class="resumen-panel resumen-panel-ancho">
      <h3>Mejor valoradas</h3>
      <p class="resumen-sub">Propiedades con reseñas de usuarios</p>
      ${listaMejorValoradas(act.mejorValoradas)}
    </div>
  </section>`;
}
