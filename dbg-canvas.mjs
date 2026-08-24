import { chromium } from "playwright";
const nav = await chromium.launch();
const p = await (await nav.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
await p.goto("https://dataflow-cyan.vercel.app/design-project.html?project=dashboard-comercial", { waitUntil: "networkidle" });
await p.waitForTimeout(3500);
// Qué elementos existen para las tareas
const info = await p.evaluate(() => {
  const cards = [...document.querySelectorAll("[data-task-id], .task-card, .project-task")];
  return {
    selectores: cards.slice(0, 4).map((c) => ({
      tag: c.tagName, cls: c.className.slice(0, 60), id: c.getAttribute("data-task-id"),
    })),
    canvasNodos: document.querySelectorAll(".flow-node, .node-card, [data-id]").length,
  };
});
console.log(JSON.stringify(info, null, 1));
const card = p.locator("[data-task-id]").nth(1);
if (await card.count()) {
  console.log("clic en:", await card.getAttribute("data-task-id"));
  await card.click();
  await p.waitForTimeout(3500);
  console.log("canvas ahora:", await p.locator(".canvas-title, h2").first().innerText().catch(() => "?"));
  console.log("nodos:", await p.locator("[data-id]").count());
}
await p.screenshot({ path: "C:/Users/juand/dashboard-comercial/canvas.png" });
await nav.close();
