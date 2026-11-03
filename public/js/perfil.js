async function renderPerfil(contenedor) {
  const u = await apiGet("/api/perfil");
  contenedor.innerHTML = `
    <div class="dashboard fade-in">
      <h2>👤 Mi perfil</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:860px;">

        <!-- Datos personales -->
        <div class="prop-form">
          <h3>Información personal</h3>

          <!-- Avatar -->
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:18px;">
            <div style="position:relative;">
              <img id="avatar-preview" src="${u.avatar || ''}" alt="avatar"
                style="width:72px;height:72px;border-radius:50%;object-fit:cover;background:#e2e8f0;border:2px solid #cbd5e1;display:${u.avatar ? 'block' : 'none'};">
              <div id="avatar-placeholder" style="width:72px;height:72px;border-radius:50%;background:#dbeafe;display:${u.avatar ? 'none' : 'flex'};align-items:center;justify-content:center;font-size:28px;color:#1e40af;font-weight:bold;border:2px solid #bfdbfe;">
                ${esc(u.nombre[0].toUpperCase())}
              </div>
            </div>
            <div>
              <label class="upload-area" style="padding:8px 14px;display:inline-block;cursor:pointer;">
                <input type="file" id="avatar-input" accept="image/*" style="display:none;" onchange="subirAvatar(this)">
                📷 Cambiar foto
              </label>
              <p style="font-size:11px;color:#94a3b8;margin-top:4px;">JPG o PNG, máx. 3 MB</p>
            </div>
          </div>

          <div class="form-grupo">
            <label>Nombre completo *</label>
            <input type="text" id="p-nombre" value="${esc(u.nombre)}">
          </div>
          <div class="form-grupo">
            <label>Email</label>
            <input type="text" value="${esc(u.email)}" disabled style="background:#f8fafc;color:#94a3b8;">
          </div>
          <div class="form-grupo">
            <label>Teléfono</label>
            <input type="tel" id="p-tel" value="${esc(u.telefono || '')}" placeholder="+57 300 000 0000">
          </div>
          <div class="form-grupo">
            <label>Bio</label>
            <textarea id="p-bio" rows="3" placeholder="Cuéntanos algo sobre ti...">${esc(u.bio || '')}</textarea>
          </div>
          <p class="form-error" id="perfil-error"></p>
          <p class="form-exito" id="perfil-exito"></p>
          <button class="btn-guardar" onclick="guardarPerfil()">Guardar cambios</button>
        </div>

        <!-- Cambiar contraseña -->
        <div class="prop-form">
          <h3>🔒 Cambiar contraseña</h3>
          <div class="form-grupo">
            <label>Contraseña actual *</label>
            <input type="password" id="pass-actual" placeholder="••••••••">
          </div>
          <div class="form-grupo">
            <label>Nueva contraseña *</label>
            <input type="password" id="pass-nueva" placeholder="Mínimo 6 caracteres">
          </div>
          <div class="form-grupo">
            <label>Confirmar nueva contraseña *</label>
            <input type="password" id="pass-confirm" placeholder="Repite la nueva contraseña">
          </div>
          <p class="form-error" id="pass-error"></p>
          <p class="form-exito" id="pass-exito"></p>
          <button class="btn-guardar" onclick="cambiarPassword()">Actualizar contraseña</button>

          <!-- Info de cuenta -->
          <div style="margin-top:24px;padding-top:18px;border-top:1px solid #e2e8f0;">
            <p style="font-size:13px;color:#64748b;margin:0 0 6px;"><strong>Rol:</strong>
              <span class="navbar-role role-${u.rol}" style="margin-left:6px;">${u.rol}</span>
            </p>
            <p style="font-size:13px;color:#64748b;margin:0;">
              <strong>Miembro desde:</strong> ${new Date(u.creado_en).toLocaleDateString("es-CO", { year:"numeric", month:"long", day:"numeric" })}
            </p>
          </div>
        </div>

      </div>
    </div>
  `;
}

async function guardarPerfil() {
  const nombre   = document.getElementById("p-nombre").value.trim();
  const telefono = document.getElementById("p-tel").value.trim();
  const bio      = document.getElementById("p-bio").value.trim();
  const errEl    = document.getElementById("perfil-error");
  const okEl     = document.getElementById("perfil-exito");
  errEl.textContent = ""; okEl.textContent = "";

  if (!nombre) { errEl.textContent = "⚠️ El nombre es obligatorio."; return; }

  const data = await apiPut("/api/perfil", { nombre, telefono, bio });
  if (data.ok) {
    okEl.textContent = "✅ " + data.mensaje;
    // Actualizar nombre en navbar
    const el = document.querySelector(".navbar-user");
    if (el) el.textContent = "👤 " + nombre;
  } else {
    errEl.textContent = "❌ " + data.error;
  }
}

async function cambiarPassword() {
  const actual   = document.getElementById("pass-actual").value;
  const nueva    = document.getElementById("pass-nueva").value;
  const confirm  = document.getElementById("pass-confirm").value;
  const errEl    = document.getElementById("pass-error");
  const okEl     = document.getElementById("pass-exito");
  errEl.textContent = ""; okEl.textContent = "";

  if (!actual || !nueva || !confirm) { errEl.textContent = "⚠️ Completa todos los campos."; return; }
  if (nueva !== confirm) { errEl.textContent = "⚠️ Las contraseñas no coinciden."; return; }
  if (nueva.length < 6)  { errEl.textContent = "⚠️ Mínimo 6 caracteres."; return; }

  const data = await apiPut("/api/perfil/password", { actual, nueva });
  if (data.ok) {
    okEl.textContent = "✅ " + data.mensaje;
    ["pass-actual","pass-nueva","pass-confirm"].forEach(id => document.getElementById(id).value = "");
  } else {
    errEl.textContent = "❌ " + data.error;
  }
}

async function subirAvatar(input) {
  if (!input.files.length) return;
  const formData = new FormData();
  formData.append("avatar", input.files[0]);

  // Preview local
  const reader = new FileReader();
  reader.onload = e => {
    const prev = document.getElementById("avatar-preview");
    const placeholder = document.getElementById("avatar-placeholder");
    if (prev) { prev.src = e.target.result; prev.style.display = "block"; }
    if (placeholder) placeholder.style.display = "none";
  };
  reader.readAsDataURL(input.files[0]);

  const res  = await fetch("/api/perfil/avatar", { method: "POST", credentials: "include", body: formData });
  const data = await res.json();
  if (!data.ok) alert("Error al subir avatar: " + data.error);
}
