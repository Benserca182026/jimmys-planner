// Publica en el canvas de DataFlow (Supabase de dataflow-rho) el proyecto
// "Jimmy's Planner" con la tarea "Calendario — antes y después" y su canvas.
// SOLO INSERTS de filas nuevas (upsert por id, ids que no existen), que es el
// mecanismo normal de la app (index.js / flow.js). Imágenes: al bucket
// "flowforge" nombradas por hash, como hace storage.js.
import fs from "node:fs";
import crypto from "node:crypto";

const URL_SB = "https://jfvmuemyjcdesnoqeaix.supabase.co";
const KEY = "sb_publishable_7l3WptofYtgvkDUHKyfwPQ_x0nl0lc1";
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function subirImagen(ruta) {
  const bytes = fs.readFileSync(ruta);
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  const objeto = `sha256/${hash}.png`;
  const info = await fetch(`${URL_SB}/storage/v1/object/info/flowforge/${objeto}`, { headers: H });
  if (!info.ok) {
    const r = await fetch(`${URL_SB}/storage/v1/object/flowforge/${objeto}`, {
      method: "POST",
      headers: { ...H, "Content-Type": "image/png", "x-upsert": "true" },
      body: bytes,
    });
    if (!r.ok && r.status !== 409) throw new Error(`subida ${ruta}: ${r.status} ${await r.text()}`);
  }
  console.log("imagen:", ruta, "->", `storage:${objeto}`, info.ok ? "(ya existía)" : "(subida)");
  return `storage:${objeto}`;
}

async function upsert(tabla, fila, clave) {
  const r = await fetch(`${URL_SB}/rest/v1/${tabla}?on_conflict=${clave}`, {
    method: "POST",
    headers: { ...H, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(fila),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${tabla}: ${r.status} ${t}`);
  console.log(tabla, "OK:", t.slice(0, 120));
}

const refAntes = await subirImagen("capturas/antes-mes.png");
const refDespues = await subirImagen("capturas/despues-mes.png");

await upsert("flowforge_projects", {
  id: "jimmys-planner",
  title: "Jimmy's Planner",
  pill: "Planner · Calendario",
  summary: "Kanban de 51 tareas (Agenda 17_07) sobre Next+Supabase. Esta entrega: calendario mensual real.",
  accent: "#3b5bfd",
  sort_order: Date.now() % 100000,
}, "id");

await upsert("flowforge_tasks", {
  id: "jimmys-planner-calendario",
  project_id: "jimmys-planner",
  title: "Calendario — antes y después",
  status: "Entregado",
  summary: "De la vista mensual estática (Mayo–Julio fijo) a un calendario real navegable con las tareas en su día.",
  sort_order: 1,
}, "id");

await upsert("flowforge_canvases", {
  task_id: "jimmys-planner-calendario",
  zoom: 0.7,
  nodes: [
    {
      id: "antes", kind: "view-photo", source: "calendario",
      title: "ANTES · vista de mes estática",
      body: "app/mes: resúmenes fijos Mayo–Julio y lista de tareas por estado. Sin rejilla de días ni navegación.",
      image: refAntes, x: 60, y: 60,
    },
    {
      id: "despues", kind: "view-photo", source: "calendario",
      title: "DESPUÉS · calendario real",
      body: "Rejilla mensual con navegación libre, tareas en su día real (vencida / sin confirmar / confirmada / lista), pestañas por agenda y zona de candidatas sin fecha.",
      image: refDespues, x: 620, y: 60,
    },
    {
      id: "nota", kind: "text", editable: true,
      title: "QUÉ CAMBIÓ · 2026-08-25",
      body: "Nuevo /mes: calendario mensual navegable (anterior/siguiente/hoy) que pinta las 51 tareas del planner en su día real usando parsearFechaCorta, con distinción vencida/sin confirmar/confirmada/lista, clic al modal de detalle y zona siempre visible de tareas sin fecha por agenda. La vista semanal de Julio se conserva enlazada; mayo y junio redirigen al calendario. Commit 642159e, desplegado a producción el 2026-08-25.",
      x: 1180, y: 60,
    },
  ],
  links: [["antes", "despues"], ["despues", "nota"]],
}, "task_id");

console.log("\nURL directa: https://dataflow-rho.vercel.app/design-project.html?project=jimmys-planner");
