// Abre DOS ventanas de Chromium lado a lado:
//   izquierda  — el canvas con toda la documentación del rediseño
//   derecha    — el dashboard real con el recorrido argumental funcionando
// Quedan abiertas para explorarlas.
import { chromium } from "playwright";

const CANVAS = "https://dataflow-cyan.vercel.app/design-project.html?project=dashboard-comercial";
const DASH = "http://localhost:3007/";

const nav = await chromium.launch({
  headless: false,
  args: ["--window-size=1180,1040", "--window-position=10,10"],
});
const ctx = await nav.newContext({ viewport: null });

const canvas = await ctx.newPage();
await canvas.goto(CANVAS, { waitUntil: "domcontentloaded", timeout: 60000 });
await canvas.waitForSelector(".flow-node", { timeout: 30000 }).catch(() => {});
await canvas.waitForTimeout(4000);
console.log("canvas abierto ·", await canvas.locator(".flow-node").count(), "nodos ·",
  await canvas.locator("#zoom-label").innerText(), "de zoom");

const dash = await ctx.newPage();
await dash.goto(DASH, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
await dash.waitForTimeout(2500);
console.log("dashboard abierto en la segunda pestaña");

console.log("\nDos pestañas abiertas: el canvas documentado y el dashboard real.");
console.log("La ventana queda abierta — cerrala cuando termines.");
await new Promise(() => {});
