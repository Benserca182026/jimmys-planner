import { chromium } from "playwright";
const nav = await chromium.launch();
const p = await (await nav.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
await p.goto("https://dataflow-cyan.vercel.app/design-project.html?project=dashboard-comercial", { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForSelector(".flow-node", { timeout: 40000 });
await p.waitForTimeout(6000);
console.log(await p.evaluate(() => {
  const n = document.querySelector(".flow-node");
  const scroller = (() => { let e = n.parentElement; const out=[]; while (e && e !== document.body) { out.push({ tag: e.tagName+"."+(e.className||"").split(" ").slice(0,2).join("."), sw: e.scrollWidth, cw: e.clientWidth }); e = e.parentElement; } return out; })();
  return JSON.stringify({
    botonesZoom: [...document.querySelectorAll("button")].map(b=>b.id||b.title||b.textContent.trim().slice(0,12)).filter(Boolean).slice(0,20),
    cadena: scroller,
  }, null, 1);
}));
await nav.close();
