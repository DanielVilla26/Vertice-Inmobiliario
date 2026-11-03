// ── Estado del calendario ──────────────────────────────────────────────────────
let calState = {
  propiedadId: null,
  propiedadTitulo: "",
  anio: new Date().getFullYear(),
  mes: new Date().getMonth(),  // 0-based
  fechaSeleccionada: null,
  horaSeleccionada: null,
  ocupadas: []  // [{fecha, hora}]
};

const HORAS = ["09:00","10:00","11:00","12:00","14:00","15:00","16:00","17:00"];
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS  = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

// ── Abrir modal de reserva ─────────────────────────────────────────────────────
async function abrirReserva(propiedadId, propiedadTitulo) {
  cerrarModal("modal-detalle");

  calState.propiedadId    = propiedadId;
  calState.propiedadTitulo = propiedadTitulo;
  calState.fechaSeleccionada = null;
  calState.horaSeleccionada  = null;
  calState.anio = new Date().getFullYear();
  calState.mes  = new Date().getMonth();

  const ocupadas = await apiGet(`/api/reservas/ocupadas/${propiedadId}`);
  calState.ocupadas = ocupadas;

  mostrarModalReserva();
}

function mostrarModalReserva() {
  // Crear modal si no existe
  let overlay = document.getElementById("modal-reserva");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "modal-reserva";
    overlay.innerHTML = `<div class="modal-box" id="modal-reserva-content" style="max-width:520px;"></div>`;
    overlay.addEventListener("click", e => { if (e.target === overlay) cerrarModal("modal-reserva"); });
    document.body.appendChild(overlay);
  }

  overlay.classList.add("active");
  renderCalendario();
}

function renderCalendario() {
  const content = document.getElementById("modal-reserva-content");

  const hoy        = new Date();
  const primerDia  = new Date(calState.anio, calState.mes, 1).getDay();
  const diasEnMes  = new Date(calState.anio, calState.mes + 1, 0).getDate();

  // Días del mes
  let celdas = "";
  for (let i = 0; i < primerDia; i++) celdas += `<div class="cal-day empty"></div>`;

  for (let d = 1; d <= diasEnMes; d++) {
    const fechaStr = `${calState.anio}-${String(calState.mes+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const fecha    = new Date(calState.anio, calState.mes, d);
    const esHoy    = fechaStr === hoy.toISOString().slice(0,10);
    const pasado   = fecha < new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const esFin    = fecha.getDay() === 0 || fecha.getDay() === 6;
    const selec    = fechaStr === calState.fechaSeleccionada;

    let cls = "cal-day";
    if (pasado || esFin) cls += " disabled";
    else if (selec) cls += " selected";
    else if (esHoy) cls += " today";

    const click = (!pasado && !esFin) ? `onclick="seleccionarFecha('${fechaStr}')"` : "";
    celdas += `<div class="${cls}" ${click}>${d}</div>`;
  }

  // Horas disponibles
  let horasHtml = "";
  if (calState.fechaSeleccionada) {
    horasHtml = `
      <p style="font-size:13px;font-weight:bold;color:#475569;margin:16px 0 8px;text-transform:uppercase;letter-spacing:.04em;">
        Horarios disponibles
      </p>
      <div class="horas-grid">
        ${HORAS.map(h => {
          const ocupada = calState.ocupadas.some(o => o.fecha === calState.fechaSeleccionada && o.hora === h);
          const sel     = h === calState.horaSeleccionada;
          return `<button class="hora-btn ${sel ? "selected" : ""}" ${ocupada ? "disabled" : ""} onclick="seleccionarHora('${h}')">${h}</button>`;
        }).join("")}
      </div>
    `;
  }

  // Nota y botón confirmar
  let confirmarHtml = "";
  if (calState.fechaSeleccionada && calState.horaSeleccionada) {
    confirmarHtml = `
      <div style="margin-top:14px;display:flex;gap:12px;flex-wrap:wrap;">
        <div style="flex:1;min-width:150px;">
          <label style="font-size:12px;font-weight:bold;color:#475569;text-transform:uppercase;letter-spacing:.04em;">Personas que vivirían</label>
          <input type="number" id="res-personas" min="1" max="99" value="1" style="width:100%;margin-top:5px;padding:8px 12px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:14px;">
        </div>
        <div style="flex:1;min-width:150px;">
          <label style="font-size:12px;font-weight:bold;color:#475569;text-transform:uppercase;letter-spacing:.04em;">¿Con mascotas?</label>
          <select id="res-mascotas" style="width:100%;margin-top:5px;padding:9px 12px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:14px;background:white;">
            <option value="0">No</option>
            <option value="1">Sí</option>
          </select>
        </div>
      </div>
      <div style="margin-top:14px;">
        <label style="font-size:12px;font-weight:bold;color:#475569;text-transform:uppercase;letter-spacing:.04em;">Nota (opcional)</label>
        <textarea id="res-nota" rows="2" style="width:100%;margin-top:5px;padding:8px 12px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:14px;resize:vertical;" placeholder="Ej: Vengo con mi pareja..."></textarea>
      </div>
      <p class="form-error" id="res-error"></p>
      <p class="form-exito" id="res-exito"></p>
      <button class="modal-btn" id="btn-confirmar-res" onclick="confirmarReserva()">
        ✅ Confirmar visita para el ${formatFecha(calState.fechaSeleccionada)} a las ${calState.horaSeleccionada}
      </button>
    `;
  }

  content.innerHTML = `
    <button class="close-btn close-btn-dark" onclick="cerrarModal('modal-reserva')" style="color:#64748b;top:12px;right:14px;">×</button>
    <div style="padding:22px;">
      <h2 style="font-size:17px;margin-bottom:4px;">📅 Agendar visita</h2>
      <p style="font-size:13px;color:#64748b;margin-bottom:16px;">${calState.propiedadTitulo}</p>

      <div class="calendario-wrap" style="padding:0;box-shadow:none;">
        <div class="cal-header">
          <button class="cal-nav" onclick="cambiarMes(-1)">‹</button>
          <h3>${MESES[calState.mes]} ${calState.anio}</h3>
          <button class="cal-nav" onclick="cambiarMes(1)">›</button>
        </div>
        <div class="cal-grid">
          ${DIAS.map(d => `<div class="cal-day-name">${d}</div>`).join("")}
          ${celdas}
        </div>
      </div>

      ${horasHtml}
      ${confirmarHtml}
    </div>
  `;
}

function cambiarMes(delta) {
  calState.mes += delta;
  if (calState.mes < 0)  { calState.mes = 11; calState.anio--; }
  if (calState.mes > 11) { calState.mes = 0;  calState.anio++; }
  calState.fechaSeleccionada = null;
  calState.horaSeleccionada  = null;
  renderCalendario();
}

function seleccionarFecha(fecha) {
  calState.fechaSeleccionada = fecha;
  calState.horaSeleccionada  = null;
  renderCalendario();
}

function seleccionarHora(hora) {
  calState.horaSeleccionada = hora;
  renderCalendario();
}

async function confirmarReserva() {
  const nota   = document.getElementById("res-nota")?.value.trim() || "";
  const personas = document.getElementById("res-personas")?.value || "";
  const mascotas = document.getElementById("res-mascotas")?.value === "1";
  const errEl  = document.getElementById("res-error");
  const okEl   = document.getElementById("res-exito");
  const btnEl  = document.getElementById("btn-confirmar-res");
  if (errEl) errEl.textContent = "";
  if (okEl)  okEl.textContent  = "";

  btnEl.disabled = true;
  btnEl.textContent = "Enviando...";

  const data = await apiPost("/api/reservas", {
    propiedad_id: calState.propiedadId,
    fecha: calState.fechaSeleccionada,
    hora:  calState.horaSeleccionada,
    nota,
    personas,
    mascotas
  });

  if (data.ok) {
    if (okEl) okEl.textContent = "✅ " + data.mensaje;
    btnEl.textContent = "¡Visita agendada!";
    // Recargar ocupadas
    const ocupadas = await apiGet(`/api/reservas/ocupadas/${calState.propiedadId}`);
    calState.ocupadas = ocupadas;
    setTimeout(() => cerrarModal("modal-reserva"), 2000);
  } else {
    if (errEl) errEl.textContent = "❌ " + data.error;
    btnEl.disabled = false;
    btnEl.textContent = `✅ Confirmar visita`;
  }
}

function formatFecha(str) {
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}
