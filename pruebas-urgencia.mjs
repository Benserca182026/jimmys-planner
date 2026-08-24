// Prueba del análisis de urgencia contra PRODUCCIÓN.
// Cambia prioridades y fechas reales, y verifica que las bandas se recalculen.
// Guarda antes el estado original en respaldo-urgencia.json para poder volver.

const BASE = "https://jimmys-planner.vercel.app";
let cookie = "";

async function login() {
  const r = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario: "Jimmy", contrasena: "Jimmy123" }),
  });
  cookie = (r.headers.get("set-cookie") ?? "").split(";")[0];
  return r.ok;
}

const leer = async () =>
  (await (await fetch(`${BASE}/api/tareas`, { headers: { cookie } })).json()).tareas;

const escribir = async (cuerpo) =>
  (await fetch(`${BASE}/api/tareas`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(cuerpo),
  })).ok;

// ── misma lógica de bandas que usa la pantalla ──
const dd = (n) => String(n).padStart(2, "0");
function parsear(fecha, hoy) {
  if (!fecha) return null;
  const m = String(fecha).match(/^(\d{1,2})\s*\/\s*(\d{1,2})$/);
  if (!m) return null;
  const dia = +m[1], mes = +m[2];
  let anio = hoy.getFullYear();
  if (hoy - new Date(anio, mes - 1, dia) > 92 * 864e5) anio++;
  const f = new Date(anio, mes - 1, dia);
  return f.getMonth() === mes - 1 ? f : null;
}
function clasificar(t, hoy) {
  const f = parsear(t.fecha, hoy);
  if (!f) return { banda: t.prioridad === "Urgente" ? "urgenteSinFecha" : "sinPlazo", dias: null };
  const dias = Math.round(
    (new Date(f.getFullYear(), f.getMonth(), f.getDate()) -
     new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())) / 864e5
  );
  return { banda: dias < 0 ? "vencida" : dias <= 7 ? "semana" : "comprometida", dias };
}
const ORDEN = ["vencida", "semana", "urgenteSinFecha", "comprometida", "sinPlazo"];
const TITULO = {
  vencida: "VENCIDAS", semana: "VENCEN ESTA SEMANA",
  urgenteSinFecha: "URGENTES SIN FECHA", comprometida: "COMPROMETIDAS", sinPlazo: "SIN PLAZO",
};

// ── ejecución ──
console.log("login:", await login() ? "ok" : "FALLO");
const antes = await leer();
console.log("tareas en produccion:", antes.length);

const hoy = new Date();
const enDias = (n) => {
  const d = new Date(Date.now() + n * 864e5);
  return `${dd(d.getDate())}/${dd(d.getMonth() + 1)}`;
};

// Un caso por banda, sobre tareas reales del tablero.
const CAMBIOS = [
  { id: 7,  etiqueta: "Coppel — DOT",        fecha: enDias(-6), prioridad: undefined, espera: "vencida" },
  { id: 5,  etiqueta: "Casa Pellas",         fecha: enDias(3),  prioridad: undefined, espera: "semana" },
  { id: 3,  etiqueta: "Residencia",          fecha: "",         prioridad: "Urgente", espera: "urgenteSinFecha" },
  { id: 13, etiqueta: "Fanalca",             fecha: enDias(25), prioridad: undefined, espera: "comprometida" },
  { id: 4,  etiqueta: "Rappi",               fecha: "",         prioridad: null,      espera: "sinPlazo" },
];

// Respaldo antes de tocar nada.
const respaldo = CAMBIOS.map((c) => {
  const t = antes.find((x) => x.id === c.id);
  return { id: c.id, fecha: t?.fecha ?? null, prioridad: t?.prioridad ?? null };
});
const fs = await import("node:fs");
fs.writeFileSync("respaldo-urgencia.json", JSON.stringify(respaldo, null, 2));
console.log("respaldo guardado en respaldo-urgencia.json\n");

console.log("== APLICANDO CAMBIOS ==");
for (const c of CAMBIOS) {
  const t = antes.find((x) => x.id === c.id);
  await escribir({ accion: "fecha", id: c.id, fecha: c.fecha });
  await escribir({ accion: "prioridad", id: c.id, prioridad: c.prioridad ?? null });
  console.log(
    `  #${c.id} ${c.etiqueta.padEnd(22)} fecha: ${String(t?.fecha ?? "—").padEnd(6)} -> ${c.fecha || "—"}` +
    `   prioridad: ${String(t?.prioridad ?? "—").padEnd(8)} -> ${c.prioridad ?? "—"}`
  );
}

console.log("\n== RELEYENDO DE LA BASE Y RECLASIFICANDO ==");
const despues = await leer();
const abiertas = despues.filter((t) => t.estado !== "listo");
const porBanda = {};
for (const t of abiertas) {
  const { banda, dias } = clasificar(t, hoy);
  (porBanda[banda] ??= []).push({ ...t, dias });
}

let errores = 0;
for (const b of ORDEN) {
  const lista = (porBanda[b] ?? []).sort((x, y) =>
    x.dias !== null && y.dias !== null ? x.dias - y.dias : 0
  );
  if (!lista.length) continue;
  console.log(`\n${TITULO[b]} (${lista.length})`);
  for (const t of lista.slice(0, 4)) {
    const cuando =
      t.dias === null
        ? (t.prioridad ?? "sin prioridad")
        : t.dias < 0 ? `vencio hace ${-t.dias} d` : t.dias === 0 ? "vence HOY" : `en ${t.dias} d`;
    console.log(`   ${t.empresa.padEnd(18)} ${String(t.fecha ?? "—").padEnd(6)} ${cuando}`);
  }
}

console.log("\n== VERIFICACION ==");
for (const c of CAMBIOS) {
  const t = despues.find((x) => x.id === c.id);
  const { banda } = clasificar(t, hoy);
  const bien = banda === c.espera;
  if (!bien) errores++;
  console.log(`  ${bien ? "OK " : "MAL"} #${c.id} ${c.etiqueta.padEnd(22)} esperada ${c.espera.padEnd(16)} obtenida ${banda}`);
}
console.log(errores === 0 ? "\nTodas las bandas se recalcularon bien." : `\n${errores} discrepancia(s).`);
