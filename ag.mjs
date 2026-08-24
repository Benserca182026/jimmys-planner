import { chromium } from "playwright";
const D = "C:/Users/juand/SAAAS-Marketing/proyectos/dashboard-cxc/evidencias-rediseno";
const nav = await chromium.launch();
const p = await (await nav.newContext({ viewport: { width: 1500, height: 760 } })).newPage();
const err = []; p.on("pageerror", e => err.push(String(e).slice(0,100)));
await p.goto("http://localhost:3007/", { waitUntil: "networkidle" });
await p.waitForTimeout(2200);
const bots = p.locator('[aria-label^="Rastreador"], [aria-label^="Balanza"], [aria-label^="Cronómetro"], [aria-label^="Sello"]');
console.log("agentes:", await bots.count());
for (const n of ["Rastreador", "Balanza", "Cronómetro", "Sello"]) {
  await p.locator(`[aria-label^="${n}"]`).hover();
  await p.waitForTimeout(700);
  const t = await p.locator("div.tarjeta-flotante.absolute").innerText();
  console.log(`— ${n}:`, t.split("\n").slice(1, 2).join(" ").slice(0, 130));
}
await p.locator('[aria-label^="Rastreador"]').hover();
await p.waitForTimeout(600);
await p.screenshot({ path: `${D}/23-agente-hover.png` });
console.log("errores JS:", err.length ? err : 0);
await nav.close();
