// Recorrido VISIBLE del tablero. Abre una ventana de Chromium de verdad y va
// haciendo todo despacio para poder seguirlo con el ojo. Al terminar, deja el
// navegador abierto para que puedas tocarlo vos.
//
//   node pw-ver.mjs                        → contra localhost:3000
//   node pw-ver.mjs https://...vercel.app  → contra producción

import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";

const nav = await chromium.launch({
  headless: false,
  slowMo: 700, // freno para que se vea cada acción
  args: ["--window-size=1500,950", "--window-position=40,40"],
});
const ctx = await nav.newContext({ viewport: { width: 1440, height: 860 } });
const p = await ctx.newPage();

/** Cartel flotante dentro de la página, para ir narrando el recorrido. */
async function decir(texto) {
  console.log("→", texto);
  await p.evaluate((t) => {
    let c = document.getElementById("__narrador");
    if (!c) {
      c = document.createElement("div");
      c.id = "__narrador";
      c.style.cssText =
        "position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:99999;" +
        "background:#0a0f2e;color:#fff;padding:12px 22px;border-radius:999px;" +
        "font:600 15px system-ui;box-shadow:0 12px 40px rgba(0,0,0,.5);" +
        "border:1px solid rgba(255,255,255,.2);pointer-events:none";
      document.body.appendChild(c);
    }
    c.textContent = t;
  }, texto).catch(() => {});
  await p.waitForTimeout(900);
}

await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await decir("1 · Entrando al planner");
await p.fill('input[autocomplete="username"]', "Jimmy");
await p.fill('input[type="password"]', "Jimmy123");
await p.click('button[type="submit"]');
await p.waitForTimeout(2500);

await decir("2 · Datos traídos de Supabase, no del navegador");
await p.waitForTimeout(800);

await decir("3 · Los grupos arrancan contraídos");
await p.locator("button[aria-expanded]").first().scrollIntoViewIfNeeded();
await p.waitForTimeout(600);

await decir("4 · Despliego una categoría");
await p.locator("button[aria-expanded]").first().click();
await p.waitForTimeout(1200);

await decir("5 · Abro el reporte de urgencia de Pendiente");
await p.locator('div.cursor-pointer:has-text("Pendiente")').first().click();
await p.waitForTimeout(2000);

await decir("6 · Ordena por vencimiento, en bandas — no por puntaje");
await p.waitForTimeout(2200);

await decir("7 · Cambio a la pestaña Agenda México");
await p.locator('button:has-text("Agenda México")').first().click();
await p.waitForTimeout(1800);

await decir("8 · Abro una tarjeta");
await p.locator("button[aria-expanded]").first().click();
await p.waitForTimeout(700);
const tarjeta = p.locator("article").first();
if (await tarjeta.count()) {
  await tarjeta.click();
  await p.waitForTimeout(2000);
  await decir("9 · Estado, prioridad, confirmación y agendar en Google");
  await p.waitForTimeout(2500);
  await p.keyboard.press("Escape").catch(() => {});
  await p.locator("button[aria-label='Cerrar']").first().click().catch(() => {});
}

await decir("Listo — el navegador queda abierto para que lo pruebes vos");
console.log("\nEl navegador queda abierto. Cerralo cuando termines.");
