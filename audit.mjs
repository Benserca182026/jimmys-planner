import { chromium } from "playwright";
const R = ["/", "/aging", "/prioritarios", "/ventas", "/inventario", "/forecast", "/seguimiento", "/datos"];
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1500, height: 1100 } });
for (const r of R) {
  const p = await ctx.newPage();
  const err = [];
  p.on("pageerror", e => err.push(String(e).slice(0, 90)));
  await p.goto("http://localhost:3007" + r, { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  const f = await p.locator(".tarjeta-flotante").count();
  const e = await p.locator(".entrada-suave").count();
  const lab = await p.locator(".etiqueta-fase").count();
  console.log(`${r.padEnd(14)} flotante:${String(f).padStart(2)}  entrada:${String(e).padStart(2)}  etiqueta-fase:${String(lab).padStart(2)}  errJS:${err.length}${err.length ? " " + err[0] : ""}`);
  await p.close();
}
await nav.close();
