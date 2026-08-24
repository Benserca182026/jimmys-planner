import { chromium } from "playwright";
const nav = await chromium.launch({ headless: false, args: ["--window-size=1540,1020", "--window-position=18,18"] });
const p = await (await nav.newContext({ viewport: null })).newPage();
await p.goto("http://localhost:3007/", { waitUntil: "networkidle", timeout: 60000 });
await p.waitForTimeout(2200);
console.log("abierto · pasá el mouse por los 4 agentes y hacé clic para fijar uno");
await new Promise(() => {});
