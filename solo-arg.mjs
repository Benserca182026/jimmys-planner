import { chromium } from "playwright";
const D = "C:/Users/juand/SAAAS-Marketing/proyectos/dashboard-cxc/evidencias-rediseno";
const nav = await chromium.launch();
const p = await (await nav.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
const err = []; p.on("pageerror", e => err.push(String(e).slice(0, 100)));
await p.goto("http://localhost:3007/", { waitUntil: "networkidle" });
await p.waitForTimeout(3000);
const sec = p.locator("section.lienzo-referencia");
console.log("bloque encontrado:", await sec.count());
await sec.first().screenshot({ path: `${D}/20-argumento-piel.png` });
const info = await p.evaluate(() => {
  const s = document.querySelector("section.lienzo-referencia");
  const t = s.querySelector(".tarjeta-calada");
  const otra = document.querySelector(".tarjeta-flotante");
  const cs = getComputedStyle(s), ct = getComputedStyle(t);
  return {
    fuenteBloque: cs.fontFamily.split(",")[0],
    fuenteResto: getComputedStyle(otra).fontFamily.split(",")[0],
    rayas: /repeating-linear-gradient/.test(cs.backgroundImage),
    fondoTarjeta: ct.backgroundColor,
    blur: ct.backdropFilter,
  };
});
console.log(JSON.stringify(info, null, 1));
console.log("errores JS:", err.length ? err : 0);
await nav.close();
