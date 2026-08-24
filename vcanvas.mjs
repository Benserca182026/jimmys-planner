import { chromium } from "playwright";
const URL = "https://dataflow-cyan.vercel.app/design-project.html?project=dashboard-comercial";
const nav = await chromium.launch();
const p = await (await nav.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForSelector(".flow-node", { timeout: 40000 });
await p.waitForTimeout(9000);
const r = await p.evaluate(() => {
  const im = [...document.querySelectorAll(".flow-node img")];
  return {
    nodos: document.querySelectorAll(".flow-node").length,
    imgs: im.length,
    rotas: im.filter(i => !i.complete || i.naturalWidth === 0).length,
    nuevos: [...document.querySelectorAll(".flow-node")].filter(n => /Etapa 2/.test(n.innerText)).length,
  };
});
console.log(JSON.stringify(r));
await nav.close();
