import { chromium } from "playwright";
const D = "C:/Users/juand/SAAAS-Marketing/proyectos/dashboard-cxc/evidencias-rediseno";
const R = [["/","30-inicio"],["/aging","31-aging"],["/ventas","32-ventas"],["/forecast","33-forecast"]];
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1500, height: 1000 } });
for (const [r, n] of R) {
  const p = await ctx.newPage();
  await p.goto("http://localhost:3007" + r, { waitUntil: "networkidle" });
  await p.waitForTimeout(2200);
  await p.screenshot({ path: `${D}/${n}.png` });
  const f = await p.evaluate(() => getComputedStyle(document.querySelector(".tarjeta-flotante")).backdropFilter);
  console.log(r.padEnd(11), "vidrio:", f);
  await p.close();
}
await nav.close();
