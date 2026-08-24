// Descarga el sitio FlowForge Visual completo desde Vercel, siguiendo las
// referencias entre archivos. Es estático, así que basta con seguir los enlaces.
import fs from "node:fs";
import path from "node:path";

const ORIGEN = "https://flowforge-visual.vercel.app";
const DESTINO = "C:/Users/juand/dataflow";

const porVisitar = ["index.html"];
const visitados = new Set();

const esTexto = (n) => /\.(html|css|js|json|svg|txt|md)$/i.test(n);

while (porVisitar.length) {
  const rel = porVisitar.shift().replace(/^\.?\//, "").split("?")[0];
  if (!rel || visitados.has(rel)) continue;
  visitados.add(rel);

  const r = await fetch(`${ORIGEN}/${rel}`);
  if (!r.ok) {
    console.log("  ✗", rel, r.status);
    continue;
  }
  const destino = path.join(DESTINO, rel);
  fs.mkdirSync(path.dirname(destino), { recursive: true });

  if (esTexto(rel)) {
    const txt = await r.text();
    fs.writeFileSync(destino, txt, "utf8");
    console.log("  ✓", rel, `(${txt.length} caracteres)`);
    // Referencias a otros archivos del mismo sitio.
    for (const m of txt.matchAll(/(?:src|href)="\.?\/?([^"#:]+\.(?:html|css|js|json|svg|png|jpg|webp))[^"]*"/g)) {
      if (!visitados.has(m[1])) porVisitar.push(m[1]);
    }
    for (const m of txt.matchAll(/(?:import|from)\s+["']\.\/([^"']+\.js)["']/g)) {
      if (!visitados.has(m[1])) porVisitar.push(m[1]);
    }
  } else {
    const buf = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(destino, buf);
    console.log("  ✓", rel, `(${buf.length} bytes)`);
  }
}
console.log(`\n${visitados.size} archivos procesados`);
