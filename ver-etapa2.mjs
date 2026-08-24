// Abre el canvas mostrando la COLUMNA ENTERA de Etapa 2, no un recorte.
// Se aleja hasta que los 4 nodos de texto + las 5 evidencias entren juntos.
import { chromium } from "playwright";

const URL = "https://dataflow-cyan.vercel.app/design-project.html?project=dashboard-comercial";
const nav = await chromium.launch({
  headless: false,
  args: ["--window-size=1560,1020", "--window-position=15,15", "--force-device-scale-factor=1"],
});
const p = await (await nav.newContext({ viewport: null })).newPage();
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForSelector(".flow-node", { timeout: 40000 });
await p.waitForTimeout(7000);

const contar = () => p.evaluate(() => [...document.querySelectorAll(".flow-node")].filter((n) => {
  const b = n.getBoundingClientRect();
  return /Etapa 2|Evidencia · (Forecast|Seguimiento|Carga|Login)/.test(n.innerText)
    && b.right > 0 && b.left < innerWidth && b.bottom > 0 && b.top < innerHeight;
}).length);

// Alejar hasta que las 9 fichas de la etapa entren en pantalla (tope: 12 clics)
let vistos = 0;
for (let i = 0; i < 12; i++) {
  await p.evaluate(() => {
    const n = [...document.querySelectorAll(".flow-node")].find((x) => /Etapa 2 · La estética/.test(x.innerText));
    n?.scrollIntoView({ block: "center", inline: "center" });
  });
  await p.waitForTimeout(500);
  vistos = await contar();
  if (vistos >= 9) break;
  await p.click("#zoom-out");
  await p.waitForTimeout(450);
}
// Encuadre final: centrar entre los textos y las evidencias
await p.evaluate(() => {
  const n = [...document.querySelectorAll(".flow-node")].find((x) => /Etapa 2 · Login animado/.test(x.innerText));
  n?.scrollIntoView({ block: "center", inline: "center" });
  document.querySelector(".flow-stage")?.scrollBy({ left: 220 });
});
await p.waitForTimeout(2000);

const zoom = await p.evaluate(() => document.querySelector("#zoom-label")?.innerText);
const rotas = await p.evaluate(() => [...document.querySelectorAll(".flow-node img")].filter((i) => !i.complete || i.naturalWidth === 0).length);
console.log(`zoom: ${zoom} · fichas de Etapa 2 a la vista: ${await contar()}/9 · imagenes rotas: ${rotas}`);

await p.screenshot({ path: "C:/Users/juand/SAAAS-Marketing/proyectos/dashboard-cxc/evidencias-rediseno/19-canvas-etapa2.png" });
console.log("La ventana queda abierta — cerrala cuando termines.");
await new Promise(() => {});
