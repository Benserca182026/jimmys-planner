// Abre el canvas organizado en una ventana real de Chromium y la deja abierta
// para explorarlo: arrastrar el lienzo, zoom, abrir nodos y ver las capturas.
import { chromium } from "playwright";

const URL = "https://dataflow-cyan.vercel.app/design-project.html?project=dashboard-comercial";

const nav = await chromium.launch({
  headless: false,
  args: ["--window-size=1900,1050", "--window-position=10,10"],
});
const p = await (await nav.newContext({ viewport: null })).newPage();
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForSelector(".flow-node", { timeout: 30000 }).catch(() => {});
await p.waitForTimeout(3000);

console.log("canvas abierto ·", await p.locator("#zoom-label").innerText(), "de zoom");
console.log("nodos en pantalla:", await p.locator(".flow-node").count());
console.log("\nLa ventana queda abierta. Cerrala cuando termines.");
await new Promise(() => {});
