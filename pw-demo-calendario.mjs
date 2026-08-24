// DEMOSTRACIÓN COMPLETA DEL CIRCUITO CON EL CALENDARIO, EN VIVO.
//
// Abre DOS pestañas en la misma ventana: el planner y Google Calendar, para que
// se vea al mismo tiempo lo que el tablero agenda y cómo aparece del otro lado.
//
// Usa un perfil de navegador persistente (.perfil-navegador): la primera vez hay
// que entrar a Google a mano, y de ahí en adelante queda la sesión guardada.
//
//   node pw-demo-calendario.mjs

import { chromium } from "playwright";
import entorno from "@next/env";
import { createSign } from "node:crypto";
const { loadEnvConfig } = entorno;
loadEnvConfig(process.cwd());

const BASE = process.argv[2] ?? "http://localhost:3000";
const PERFIL = "./.perfil-navegador";

// ── acceso directo al calendario, para simular lo que se carga "a mano" ──
const b64 = (x) =>
  Buffer.from(x).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function tokenGoogle() {
  const email = process.env.GOOGLE_SA_EMAIL;
  const clave = (process.env.GOOGLE_SA_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  const t = Math.floor(Date.now() / 1000);
  const cab = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const cue = b64(JSON.stringify({
    iss: email, scope: "https://www.googleapis.com/auth/calendar.events",
    aud: "https://oauth2.googleapis.com/token", iat: t, exp: t + 3600,
  }));
  const firma = createSign("RSA-SHA256").update(`${cab}.${cue}`).end().sign(clave);
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${cab}.${cue}.${b64(firma)}`,
    }),
  });
  return (await r.json()).access_token;
}

/** Crea un evento SIN la marca del tablero: idéntico a uno cargado a mano. */
async function eventoAjeno(titulo, diasAdelante) {
  const cal = process.env.GOOGLE_CALENDAR_ID;
  const tk = await tokenGoogle();
  const ini = new Date(Date.now() + diasAdelante * 86400000);
  ini.setHours(15, 0, 0, 0);
  const fin = new Date(ini.getTime() + 3600000);
  const r = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal)}/events`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: titulo,
        description: "Cargado por fuera del tablero — el planner no lo conoce.",
        start: { dateTime: ini.toISOString() },
        end: { dateTime: fin.toISOString() },
      }),
    }
  );
  const d = await r.json();
  return { ok: r.ok, id: d.id, cuando: ini.toLocaleDateString("es") };
}

// ── navegador con perfil persistente ──
// Google bloquea iniciar sesión en navegadores automatizados ("This browser or
// app may not be secure"), así que el calendario lo mirás en TU navegador y acá
// sólo se automatiza el tablero. La ventana se abre angosta y a la izquierda
// para que puedas poner tu calendario al lado.
const nav = await chromium.launch({
  headless: false,
  slowMo: 650,
  args: ["--window-size=980,1000", "--window-position=10,10"],
});
const ctx = await nav.newContext({ viewport: { width: 950, height: 900 } });
const planner = await ctx.newPage();

async function decir(pagina, texto) {
  console.log("→", texto);
  await pagina.bringToFront();
  await pagina.evaluate((t) => {
    let c = document.getElementById("__narrador");
    if (!c) {
      c = document.createElement("div");
      c.id = "__narrador";
      c.style.cssText =
        "position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:2147483647;" +
        "background:#0a0f2e;color:#fff;padding:12px 24px;border-radius:999px;" +
        "font:600 15px system-ui;box-shadow:0 12px 44px rgba(0,0,0,.55);" +
        "border:1px solid rgba(255,255,255,.25);pointer-events:none;max-width:80vw;text-align:center";
      document.body.appendChild(c);
    }
    c.textContent = t;
  }, texto).catch(() => {});
  await pagina.waitForTimeout(1000);
}

// ── 1. tiempo para acomodar las ventanas ──
console.log("*** ABRI TU GOOGLE CALENDAR EN TU NAVEGADOR, AL LADO DERECHO ***");
console.log("    (no cierres esta ventana)");

// Se muestra el planner desde el arranque: una pagina en blanco durante medio
// minuto parece colgada e invita a cerrarla.
await planner.goto(`${BASE}/login`, { waitUntil: "networkidle" });
for (let i = 25; i > 0; i -= 5) {
  await decir(planner, `Abri tu Google Calendar al lado — arranco en ${i}s`);
  await planner.waitForTimeout(4000);
}

// ── 2. planner: agendar una tarea ──
await decir(planner, "1 · Entro al planner");
await planner.fill('input[autocomplete="username"]', "Jimmy");
await planner.fill('input[type="password"]', "Jimmy123");
await planner.click('button[type="submit"]');
await planner.locator("button[aria-expanded]").first().waitFor({ timeout: 25000 }).catch(() => {});

await decir(planner, "2 · Abro una categoría y una tarjeta");
await planner.locator("button[aria-expanded]").first().click();
await planner.waitForTimeout(700);
await planner.locator("article").first().click();
await planner.waitForTimeout(1200);

const cuando = new Date(Date.now() + 3 * 86400000);
cuando.setHours(11, 0, 0, 0);
const valorFecha =
  `${cuando.getFullYear()}-${String(cuando.getMonth() + 1).padStart(2, "0")}-` +
  `${String(cuando.getDate()).padStart(2, "0")}T11:00`;

await decir(planner, "3 · Elijo día y hora, y agendo en Google Calendar");
await planner.fill('input[type="datetime-local"]', valorFecha);
await planner.waitForTimeout(600);
await planner.locator('button:has-text("Agendar")').first().click();
await planner.waitForTimeout(3500);

// ── 3. mostrarlo en el calendario ──
await decir(planner, "4 · MIRÁ TU CALENDARIO → el evento ya está ahí (recargá)");
await planner.waitForTimeout(9000);

// ── 4. crear algo POR FUERA del tablero ──
console.log("\n== Creando dos eventos ajenos al tablero ==");
const a = await eventoAjeno("Almuerzo con proveedor Shad", 4);
const b2 = await eventoAjeno("Llamada Fanalca — forecast", 6);
console.log("  creado:", a.ok, a.cuando, "| creado:", b2.ok, b2.cuando);

await decir(planner, "5 · Cargué 2 eventos AJENOS al tablero — miralos en tu calendario");
await planner.waitForTimeout(9000);

// ── 5. sincronizar ──
await decir(planner, "6 · Vuelvo al tablero y pido traer del calendario");
await planner.keyboard.press("Escape").catch(() => {});
await planner.locator('button[aria-label="Cerrar"]').first().click().catch(() => {});
await planner.waitForTimeout(800);
await planner.locator('button:has-text("Traer del calendario")').first().click();
await planner.waitForTimeout(5000);

await decir(planner, "7 · Los detectó: aparecen como 'en el calendario pero no en el tablero'");
await planner.waitForTimeout(2500);

const traer = planner.locator('button:has-text("Traer al tablero")').first();
if (await traer.count()) {
  await decir(planner, "8 · Traigo uno: se crea la tarjeta y se marca el evento");
  await traer.click();
  await planner.waitForTimeout(3000);
  await decir(planner, "9 · Listo — queda emparejado en las dos direcciones");
} else {
  await decir(planner, "8 · (no aparecieron sueltos — revisar la ventana de fechas)");
}

console.log("\nLa ventana queda abierta para que sigas probando.");
await new Promise(() => {});
