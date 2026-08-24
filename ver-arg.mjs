// Abre la página 1 desplazada al bloque del argumento — el único con la piel
// completa de la referencia. Arriba queda el resto de la página SIN ella, para
// que la comparación se vea en la misma pantalla y no de memoria.
import { chromium } from "playwright";
const nav = await chromium.launch({
  headless: false,
  args: ["--window-size=1520,1040", "--window-position=20,20"],
});
const p = await (await nav.newContext({ viewport: null })).newPage();
await p.goto("http://localhost:3007/", { waitUntil: "networkidle", timeout: 60000 });
await p.waitForTimeout(2500);
await p.evaluate(() => document.querySelector("section.lienzo-referencia")
  ?.scrollIntoView({ block: "center", behavior: "instant" }));
await p.waitForTimeout(1200);
const c = await p.evaluate(() => {
  const s = document.querySelector("section.lienzo-referencia");
  const otra = document.querySelector(".tarjeta-flotante");
  return {
    bloqueConPiel: getComputedStyle(s).fontFamily.split(",")[0],
    restoDeLaPagina: getComputedStyle(otra).fontFamily.split(",")[0],
  };
});
console.log("fuente del bloque:", c.bloqueConPiel);
console.log("fuente del resto :", c.restoDeLaPagina);
await p.screenshot({ path: "C:/Users/juand/SAAAS-Marketing/proyectos/dashboard-cxc/evidencias-rediseno/21-comparacion-en-pantalla.png" });
console.log("La ventana queda abierta — cerrala cuando termines.");
await new Promise(() => {});
