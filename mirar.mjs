import { chromium } from "playwright";
const nav = await chromium.launch();
const p = await (await nav.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
await p.goto("file:///C:/Users/juand/dataflow/index.html", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
await p.screenshot({ path: "C:/Users/juand/dataflow/vista.png" });
console.log("titulo:", await p.title());
await nav.close();
