// Captura la vista de mes (local, con sesion jp_sesion emitida por /api/login).
// Uso: node cap-mes.mjs <ruta-pagina> <archivo-salida>
import { chromium } from "playwright";
const [, , ruta = "/mes/julio", salida = "capturas/antes-mes.png"] = process.argv;
const B = "http://localhost:3177";
const r = await fetch(B + "/api/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ usuario: "Jimmy", contrasena: "Jimmy123" }),
});
const cruda = r.headers.get("set-cookie") ?? "";
const valor = cruda.match(/jp_sesion=([^;]+)/)?.[1];
if (!valor) { console.error("Sin cookie jp_sesion:", r.status, cruda); process.exit(1); }
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1500, height: 1000 } });
await ctx.addCookies([{ name: "jp_sesion", value: valor, url: B }]);
const p = await ctx.newPage();
await p.goto(B + ruta, { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
await p.screenshot({ path: salida, fullPage: true });
console.log("captura:", salida, "de", ruta);
await nav.close();
