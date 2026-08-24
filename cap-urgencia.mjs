import { chromium } from "playwright";
const nav = await chromium.launch();
const p = await (await nav.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
await p.goto("https://jimmys-planner.vercel.app/login", { waitUntil: "networkidle" });
await p.fill('input[autocomplete="username"]', "Jimmy");
await p.fill('input[type="password"]', "Jimmy123");
await p.click('button[type="submit"]');
await p.locator("button[aria-expanded]").first().waitFor({ timeout: 25000 });
await p.locator('div.cursor-pointer:has-text("Pendiente")').first().click();
await p.waitForTimeout(2500);
const panel = p.locator('p:has-text("Urgencia ·"):visible').first().locator("xpath=ancestor::div[3]");
await panel.screenshot({ path: "urgencia.png" }).catch(async () => {
  await p.screenshot({ path: "urgencia.png" });
});
const texto = await p.locator('p:has-text("Urgencia ·"):visible').first().locator("xpath=ancestor::div[3]").innerText();
console.log(texto.slice(0, 700));
await nav.close();
