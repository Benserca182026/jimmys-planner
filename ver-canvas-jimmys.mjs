import { chromium } from "playwright";
const nav = await chromium.launch();
const p = await (await nav.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
await p.goto("https://dataflow-rho.vercel.app/design-project.html?project=jimmys-planner", { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(6000);
console.log("titulo:", await p.title());
console.log("texto:", (await p.locator("body").innerText()).replace(/\n+/g, " | ").slice(0, 200));
await nav.close();
