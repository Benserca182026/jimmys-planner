import { chromium } from "playwright";
const D = "C:/Users/juand/SAAAS-Marketing/proyectos/dashboard-cxc/evidencias-rediseno";
const R = ["/", "/aging", "/prioritarios", "/ventas", "/inventario", "/forecast", "/seguimiento", "/datos", "/login"];
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1500, height: 1000 } });
let malas = 0;
for (const r of R) {
  const p = await ctx.newPage();
  const err = [];
  p.on("pageerror", e => err.push(String(e).slice(0, 80)));
  const res = await p.goto("https://dashboard-cxc.vercel.app" + r, { waitUntil: "networkidle", timeout: 60000 });
  await p.waitForTimeout(1800);
  const v = await p.evaluate(() => {
    const t = document.querySelector(".tarjeta-flotante, .tarjeta-calada");
    return {
      vidrio: t ? getComputedStyle(t).backdropFilter : "—",
      piel: document.body.classList.contains("piel-referencia"),
      fuente: getComputedStyle(document.body).fontFamily.split(",")[0],
    };
  });
  const ok = res.status() === 200 && v.piel && err.length === 0;
  if (!ok) malas++;
  console.log(`${r.padEnd(14)} ${res.status()} piel:${v.piel} fuente:${v.fuente.slice(0,26)} errJS:${err.length}`);
  await p.close();
}
const p = await ctx.newPage();
await p.goto("https://dashboard-cxc.vercel.app/", { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
await p.screenshot({ path: `${D}/40-produccion.png`, fullPage: true });
const t = await p.locator("body").innerText();
console.log("cifras en produccion:", ["$7,700.00","45%","103.43 d","38.96%"].every(x => t.includes(x)));
console.log("rutas con problema:", malas);
await nav.close();
