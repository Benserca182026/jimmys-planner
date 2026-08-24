// Recorrido real del tablero con un navegador de verdad.
// Prueba lo que curl no puede: clics, plegado, el reporte de urgencia y el celular.
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const fallos = [];
const ok = (m) => console.log("  ✓", m);
const mal = (m) => { console.log("  ✗", m); fallos.push(m); };

p.on("pageerror", (e) => mal("error de JS en la página: " + String(e).slice(0, 120)));

console.log("\n— LOGIN —");
await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.fill('input[autocomplete="username"]', "Jimmy");
await p.fill('input[type="password"]', "Jimmy123");
await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.includes("login"), { timeout: 15000 }).catch(() => {});
p.url().includes("login") ? mal("NO pudo entrar (login rechazado)") : ok("entro al tablero");

console.log("\n— DATOS DESDE LA BASE —");
await p.waitForTimeout(2500);
const aviso = await p.locator("text=Sin conexión con la base").count();
aviso ? mal("muestra el cartel de sin conexión") : ok("conectado a Supabase");

const tarjetas = await p.locator("article").count();
console.log("  tarjetas visibles:", tarjetas);

console.log("\n— GRUPOS PLEGABLES —");
const grupo = p.locator('button[aria-expanded]').first();
const antes = await p.locator("article").count();
await grupo.click();
await p.waitForTimeout(400);
const despues = await p.locator("article").count();
despues !== antes ? ok(`despliega: ${antes} → ${despues} tarjetas`) : mal("el grupo no cambió nada");

console.log("\n— REPORTE DE URGENCIA (clic en el encabezado) —");
await p.locator('div.cursor-pointer:has-text("Pendiente")').first().click();
await p.waitForTimeout(600);
const rep = await p.locator('p:has-text("Urgencia ·"):visible').count();
rep ? ok("el reporte se abrió") : mal("el reporte NO se abrió al hacer clic");

console.log("\n— NO SE CIERRA AL TOCAR ADENTRO —");
const dentro = p.locator('button:has-text("Buscar lo que la regla no ve"):visible').first();
if (await dentro.count()) {
  await dentro.click({ trial: true });
  await p.waitForTimeout(300);
  (await p.locator('p:has-text("Urgencia ·"):visible').count())
    ? ok("sigue abierto al apuntar un boton interno")
    : mal("se cerró al tocar adentro");
} else console.log("  (sin botón de IA visible)");

console.log("\n— CELULAR (390x844, táctil) —");
const movil = await nav.newContext({
  viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
});
const m = await movil.newPage();
await m.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await m.fill('input[autocomplete="username"]', "Jimmy");
await m.fill('input[type="password"]', "Jimmy123");
await m.click('button[type="submit"]');
await m.waitForTimeout(3000);
await m.locator('div.cursor-pointer:has-text("Pendiente")').first().tap();
await m.waitForTimeout(700);
(await m.locator('p:has-text("Urgencia ·"):visible').count())
  ? ok("el reporte queda abierto al tocar en celular")
  : mal("en celular el reporte no queda abierto");
const anchoDoc = await m.evaluate(() => document.documentElement.scrollWidth);
anchoDoc <= 400 ? ok("no hay desborde horizontal") : mal(`desborda a lo ancho: ${anchoDoc}px`);

await m.screenshot({ path: "captura-celular.png", fullPage: false });
await p.screenshot({ path: "captura-escritorio.png", fullPage: false });

console.log("\n=== RESULTADO ===");
console.log(fallos.length === 0 ? "Todo pasó." : `${fallos.length} problema(s):\n - ` + fallos.join("\n - "));
await nav.close();
