// ── Escapar texto antes de meterlo en innerHTML (evita que se ejecute HTML/JS) ──
function esc(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// ── Helpers HTTP ──────────────────────────────────────────────────────────────
async function apiGet(url) {
  const res = await fetch(url, { credentials: "include" });
  return res.json();
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function apiPut(url, body) {
  const res = await fetch(url, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function apiDelete(url) {
  const res = await fetch(url, { method: "DELETE", credentials: "include" });
  return res.json();
}
