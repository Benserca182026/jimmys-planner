"use client";

// Estado global del planner. Desde la migración a Supabase, la memoria ya no
// vive en el navegador: vive en la base, y por eso el tablero es UNO SOLO en la
// computadora, en el celular y en la máquina de Jimmy.
//
// La interfaz que ven los componentes no cambió — moverTarea, cambiarPrioridad,
// asignarFecha, etc. siguen llamándose igual. Todo el cambio quedó acá adentro.
//
// Cómo escribe: primero actualiza la pantalla (para que se sienta instantáneo)
// y en paralelo manda el cambio a la base. Si la base rechaza, se revierte y se
// avisa — nunca se finge que se guardó algo que no se guardó.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { PENDIENTES, type Estado, type Pendiente } from "./datos";

/** Prioridad editable desde la app; `null` = sin prioridad especial. */
export type Prioridad = Pendiente["prioridad"] | null;

export interface Comentario {
  id: string;
  texto: string;
  fecha: string;
}

export interface Adjunto {
  id: string;
  nombre: string;
  tipo: string;
  tamano: number;
  /** dataURL solo para archivos chicos (<1MB); si es más grande, solo metadatos. */
  dataUrl?: string;
  fecha: string;
}

export interface Tarea extends Omit<Pendiente, "prioridad"> {
  /** `null` = el usuario le quitó la prioridad (distinto de "nunca tuvo"). */
  prioridad?: Pendiente["prioridad"] | null;
  comentarios: Comentario[];
  adjuntos: Adjunto[];
  /** Marcas de la base: habilitan la urgencia por abandono. */
  creado_en?: string;
  actualizado_en?: string;
}

interface EstadoPlanner {
  tareas: Tarea[];
  /** null = todavía cargando; true = base viva; false = sin base, modo lectura. */
  conectado: boolean | null;
  error: string | null;
  moverTarea: (id: number, estado: Estado) => void;
  cambiarPrioridad: (id: number, prioridad: Prioridad) => void;
  agregarTarea: (datos: Omit<Pendiente, "id">) => Promise<number | null>;
  asignarFecha: (id: number, fecha: string, confirmada?: "Si" | "No") => void;
  agregarComentario: (id: number, texto: string) => void;
  agregarAdjunto: (id: number, adj: Omit<Adjunto, "id" | "fecha">) => void;
  recargar: () => Promise<void>;
}

const Ctx = createContext<EstadoPlanner | null>(null);

/** Datos del Excel, por si la base no está disponible: se ve, no se edita. */
function tareasDeRespaldo(): Tarea[] {
  return PENDIENTES.map((p) => ({ ...p, comentarios: [], adjuntos: [] }));
}

const ahora = () =>
  new Date().toLocaleString("es", { dateStyle: "short", timeStyle: "short" });

export function ProveedorPlanner({ children }: { children: React.ReactNode }) {
  const [tareas, setTareas] = useState<Tarea[]>(tareasDeRespaldo);
  const [conectado, setConectado] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    try {
      const res = await fetch("/api/tareas");
      // Sin sesión, el middleware redirige al login y la respuesta llega como
      // HTML. Eso no es "la base está caída": es que todavía no entraste.
      if (res.redirected || !res.headers.get("content-type")?.includes("json")) {
        setConectado(null);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setConectado(false);
        setError(data?.mensaje ?? "No se pudo leer la base.");
        return;
      }
      setTareas(
        (data.tareas as Tarea[]).map((t) => ({
          ...t,
          comentarios: t.comentarios ?? [],
          adjuntos: t.adjuntos ?? [],
        }))
      );
      setConectado(true);
      setError(null);
    } catch {
      setConectado(false);
      setError("No se pudo contactar el servidor.");
    }
  }, []);

  // El proveedor vive en el layout raíz, así que también monta en /login. Ahí
  // no hay sesión y pedir los datos sólo produce un rechazo. Se pide al entrar
  // al tablero, y se vuelve a pedir cuando cambia la ruta — sin esto, el estado
  // de error del login quedaba pegado y el tablero mostraba el Excel de
  // respaldo con el cartel de "sin conexión" para siempre.
  const ruta = usePathname();
  useEffect(() => {
    if (ruta?.startsWith("/login")) return;
    recargar();
  }, [recargar, ruta]);

  /**
   * Aplica el cambio en pantalla, lo manda a la base, y si la base lo rechaza
   * deshace lo aplicado. Nunca se queda mostrando algo que no se guardó.
   */
  const mandar = useCallback(
    async (cuerpo: Record<string, unknown>, optimista: (t: Tarea) => Tarea, id: number) => {
      const previas = tareas;
      setTareas((p) => p.map((t) => (t.id === id ? optimista(t) : t)));
      try {
        const res = await fetch("/api/tareas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...cuerpo, id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.mensaje ?? "rechazado");
        setTareas((p) =>
          p.map((t) =>
            t.id === id
              ? { ...(data.tarea as Tarea), comentarios: data.tarea.comentarios ?? [], adjuntos: data.tarea.adjuntos ?? [] }
              : t
          )
        );
        setError(null);
      } catch (e) {
        setTareas(previas); // se revierte: la verdad la tiene la base
        setError(`No se guardó el cambio: ${String(e)}`);
      }
    },
    [tareas]
  );

  const moverTarea = useCallback(
    (id: number, estado: Estado) => {
      mandar({ accion: "estado", estado }, (t) => ({ ...t, estado }), id);
    },
    [mandar]
  );

  const cambiarPrioridad = useCallback(
    (id: number, prioridad: Prioridad) => {
      mandar({ accion: "prioridad", prioridad }, (t) => ({ ...t, prioridad }), id);
    },
    [mandar]
  );

  const asignarFecha = useCallback(
    (id: number, fecha: string, confirmada?: "Si" | "No") => {
      mandar(
        { accion: "fecha", fecha, confirmada },
        (t) => ({ ...t, fecha: fecha || undefined, confirmada }),
        id
      );
    },
    [mandar]
  );

  const agregarComentario = useCallback(
    (id: number, texto: string) => {
      const item: Comentario = { id: `c-${Date.now()}`, texto, fecha: ahora() };
      mandar(
        { accion: "comentario", item },
        (t) => ({ ...t, comentarios: [...t.comentarios, item] }),
        id
      );
    },
    [mandar]
  );

  const agregarAdjunto = useCallback(
    (id: number, adj: Omit<Adjunto, "id" | "fecha">) => {
      const item: Adjunto = { ...adj, id: `a-${Date.now()}`, fecha: ahora() };
      mandar({ accion: "adjunto", item }, (t) => ({ ...t, adjuntos: [...t.adjuntos, item] }), id);
    },
    [mandar]
  );

  const agregarTarea = useCallback(
    async (datos: Omit<Pendiente, "id">): Promise<number | null> => {
      try {
        const res = await fetch("/api/tareas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accion: "crear", datos }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.mensaje ?? "rechazado");
        const nueva = { ...(data.tarea as Tarea), comentarios: [], adjuntos: [] };
        setTareas((p) => [...p, nueva]);
        return nueva.id;
      } catch (e) {
        setError(`No se pudo crear la tarea: ${String(e)}`);
        return null;
      }
    },
    []
  );

  const valor = useMemo(
    () => ({
      tareas, conectado, error,
      moverTarea, cambiarPrioridad, agregarTarea, asignarFecha,
      agregarComentario, agregarAdjunto, recargar,
    }),
    [tareas, conectado, error, moverTarea, cambiarPrioridad, agregarTarea,
     asignarFecha, agregarComentario, agregarAdjunto, recargar]
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function usePlanner(): EstadoPlanner {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePlanner debe usarse dentro de <ProveedorPlanner>");
  return ctx;
}
