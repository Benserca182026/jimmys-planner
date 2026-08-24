import { chromium } from "playwright";
const D = "C:/Users/juand/SAAAS-Marketing/proyectos/dashboard-cxc/evidencias-rediseno";
const nav = await chromium.launch();
const p = await (await nav.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
const err = []; p.on("pageerror", e => err.push(String(e).slice(0,120)));
await p.goto("http://localhost:3007/login", { waitUntil: "networkidle" });
await p.waitForTimeout(600);
await p.screenshot({ path: `${D}/17-login-animando.png` });   // mitad de la animacion
await p.waitForTimeout(2200);
await p.screenshot({ path: `${D}/18-login.png` });            // ya asentado
console.log("flotantes:", await p.locator(".tarjeta-flotante").count(),
            "| lineas dibujadas:", await p.locator(".linea-dibujada").count(),
            "| aviso de que no es auth real:", /no es un inicio de sesión real/i.test(await p.locator("body").innerText()));
await p.locator("button[type=submit]").click();
await p.waitForURL("**/", { timeout: 8000 });
await p.waitForTimeout(1500);
console.log("tras entrar → URL:", new URL(p.url()).pathname, "| errores JS:", err.length ? err : 0);
await nav.close();
