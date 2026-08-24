import { NextResponse } from "next/server";
import { PENDIENTES } from "@/lib/datos";
import { base, hayBase } from "@/lib/supabase";

// Puerta única entre el tablero y la base. El navegador no conoce Supabase:
// pide y manda por acá, y esta ruta ya está protegida por el login.

export const dynamic = "force-dynamic";

/** Siembra las 51 tareas del Excel la primera vez, y sólo la primera. */
async function sembrarSiHaceFalta() {
  const db = base();
  const { count, error } = await db.from("tareas").select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  if ((count ?? 0) > 0) return { sembradas: 0 };

  const filas = PENDIENTES.map((p) => ({
    id: p.id,
    empresa: p.empresa,
    tema: p.tema,
    categoria: p.categoria,
    estado: p.estado,
    agenda: p.agenda ?? null,
    prioridad: p.prioridad ?? null,
    involucrados: p.involucrados ?? null,
    fecha: p.fecha ?? null,
    confirmada: p.confirmada ?? null,
    observaciones: p.observaciones ?? null,
    comentarios: [],
    adjuntos: [],
  }));
  const { error: e2 } = await db.from("tareas").insert(filas);
  if (e2) throw new Error(e2.message);
  return { sembradas: filas.length };
}

export async function GET() {
  if (!hayBase()) {
    return NextResponse.json(
      { error: "sin_base", mensaje: "Falta configurar Supabase (SUPABASE_URL / SUPABASE_SECRET_KEY)." },
      { status: 400 }
    );
  }
  try {
    const info = await sembrarSiHaceFalta();
    const { data, error } = await base().from("tareas").select("*").order("id");
    if (error) throw new Error(error.message);
    return NextResponse.json({ tareas: data, ...info });
  } catch (e) {
    return NextResponse.json({ error: "base", mensaje: String(e) }, { status: 502 });
  }
}

export async function POST(req: Request) {
  if (!hayBase()) {
    return NextResponse.json({ error: "sin_base" }, { status: 400 });
  }
  const cuerpo = await req.json().catch(() => ({}));
  const { accion, id } = cuerpo as { accion?: string; id?: number };
  const db = base();

  try {
    switch (accion) {
      case "estado": {
        const { data, error } = await db
          .from("tareas").update({ estado: cuerpo.estado }).eq("id", id).select().single();
        if (error) throw new Error(error.message);
        return NextResponse.json({ tarea: data });
      }
      case "prioridad": {
        const { data, error } = await db
          .from("tareas").update({ prioridad: cuerpo.prioridad ?? null }).eq("id", id).select().single();
        if (error) throw new Error(error.message);
        return NextResponse.json({ tarea: data });
      }
      case "fecha": {
        const { data, error } = await db
          .from("tareas")
          .update({ fecha: cuerpo.fecha || null, confirmada: cuerpo.confirmada ?? null })
          .eq("id", id).select().single();
        if (error) throw new Error(error.message);
        return NextResponse.json({ tarea: data });
      }
      // Comentarios y adjuntos se leen y reescriben enteros: son listas cortas
      // y así se evita depender de funciones de Postgres para anexar a jsonb.
      case "comentario":
      case "adjunto": {
        const campo = accion === "comentario" ? "comentarios" : "adjuntos";
        const { data: actual, error: e1 } = await db
          .from("tareas").select(campo).eq("id", id).single();
        if (e1) throw new Error(e1.message);
        const lista = ((actual as Record<string, unknown>)?.[campo] as unknown[]) ?? [];
        const { data, error } = await db
          .from("tareas").update({ [campo]: [...lista, cuerpo.item] }).eq("id", id).select().single();
        if (error) throw new Error(error.message);
        return NextResponse.json({ tarea: data });
      }
      case "crear": {
        const { data: max } = await db
          .from("tareas").select("id").order("id", { ascending: false }).limit(1).single();
        const nuevoId = Math.max(999, max?.id ?? 0) + 1;
        const { data, error } = await db
          .from("tareas")
          .insert({ ...cuerpo.datos, id: nuevoId, comentarios: [], adjuntos: [] })
          .select().single();
        if (error) throw new Error(error.message);
        return NextResponse.json({ tarea: data });
      }
      default:
        return NextResponse.json({ error: "accion_desconocida", accion }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: "base", mensaje: String(e) }, { status: 502 });
  }
}
