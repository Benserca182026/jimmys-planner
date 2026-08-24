"use client";

// LA VUELTA — qué dice el calendario de lo que el tablero agendó.
//
// Tres reglas que gobiernan este componente, y salen de lo que discutimos:
//  · Sólo muestra divergencias; NUNCA aplica nada solo. El instrumento no mueve
//    la mano.
//  · De la ausencia no se sigue borrar: un evento cancelado se señala, no se
//    elimina; la decisión queda en la persona.
//  · Cada renglón dice de dónde salió el dato, para poder verificarlo.

import { useState } from "react";
import { usePlanner } from "@/lib/estado";

interface EventoLeido {
  idTarea: number;
  idEvento: string;
  titulo: string;
  inicio: string | null;
  fechaCorta: string | null;
  cancelado: boolean;
  ocurrio: boolean;
  link: string | null;
}

type Tipo = "movido" | "cancelado" | "ocurrio";

interface Divergencia {
  tipo: Tipo;
  idTarea: number;
  empresa: string;
  tema: string;
  detalle: string;
  fechaNueva?: string;
  link: string | null;
}

const COLOR: Record<Tipo, string> = {
  movido: "#f0a13a",
  cancelado: "#dc2626",
  ocurrio: "#12b3a8",
};

const ETIQUETA: Record<Tipo, string> = {
  movido: "cambió de fecha",
  cancelado: "cancelado en el calendario",
  ocurrio: "ya pasó",
};

interface EventoSuelto {
  idEvento: string;
  titulo: string;
  descripcion: string;
  fechaCorta: string | null;
  dias: number | null;
  link: string | null;
}

export function SincronizarCalendario() {
  const { tareas, asignarFecha, moverTarea, agregarTarea } = usePlanner();
  const [sueltos, setSueltos] = useState<EventoSuelto[] | null>(null);
  const [traidos, setTraidos] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [divergencias, setDivergencias] = useState<Divergencia[] | null>(null);
  const [resueltas, setResueltas] = useState<Set<string>>(new Set());
  // Cuántos eventos se revisaron: sin esto, "no encontré nada" y "no funcionó"
  // se ven exactamente igual, y el silencio se lee como falla.
  const [revisados, setRevisados] = useState<number | null>(null);
  const [huerfanos, setHuerfanos] = useState(0);

  const sincronizar = async () => {
    setCargando(true);
    setError(null);
    setDivergencias(null);
    setResueltas(new Set());
    try {
      const res = await fetch("/api/google/sincronizar");
      const data = await res.json();
      if (!res.ok) {
        setError(data?.mensaje ?? "No se pudo leer el calendario.");
        return;
      }
      const eventos = (data.eventos ?? []) as EventoLeido[];
      const encontradas: Divergencia[] = [];
      setRevisados(eventos.length);
      let sinTarea = 0;

      for (const ev of eventos) {
        const t = tareas.find((x) => x.id === ev.idTarea);
        if (!t) {
          sinTarea++;
          continue;
        }
        const base = { idTarea: t.id, empresa: t.empresa, tema: t.tema, link: ev.link };

        if (ev.cancelado) {
          // Si la tarjeta ya no tiene fecha, la cancelación no deja nada por
          // hacer: avisarlo igual sería ruido que vuelve en cada sincronización.
          // Sólo importa cuando el tablero todavía afirma una fecha que en el
          // calendario ya no existe.
          if (!t.fecha) continue;
          encontradas.push({
            ...base,
            tipo: "cancelado",
            detalle: `El evento fue cancelado en Google Calendar, pero la tarjeta sigue diciendo ${t.fecha}.`,
          });
          continue;
        }
        // Un evento cancelado no propone fechas ni cierres: ya se resolvió arriba.
        if (ev.fechaCorta && t.fecha !== ev.fechaCorta) {
          encontradas.push({
            ...base,
            tipo: "movido",
            detalle: `El calendario dice ${ev.fechaCorta}; la tarjeta dice ${t.fecha ?? "sin fecha"}.`,
            fechaNueva: ev.fechaCorta,
          });
          continue;
        }
        if (ev.ocurrio && t.estado !== "listo") {
          encontradas.push({
            ...base,
            tipo: "ocurrio",
            detalle: `La reunión ya pasó y la tarea sigue en ${t.estado}. ¿Quedó cerrada?`,
          });
        }
      }
      setHuerfanos(sinTarea);
      setSueltos((data.sueltos ?? []) as EventoSuelto[]);
      setDivergencias(encontradas);
    } catch {
      setError("No se pudo contactar el servidor.");
    } finally {
      setCargando(false);
    }
  };

  const marcar = (clave: string) => setResueltas(new Set(resueltas).add(clave));

  /**
   * Trae un evento del calendario al tablero como tarea, y de paso le estampa
   * al evento el número de tarea: desde ese momento quedan emparejados en las
   * dos direcciones y el evento deja de ser "suelto".
   */
  const traerAlTablero = async (ev: EventoSuelto) => {
    const id = await agregarTarea({
      empresa: ev.titulo.slice(0, 60),
      tema: ev.descripcion.split("\n")[0]?.slice(0, 120) || "Traído del calendario",
      categoria: "Agenda interna",
      // Viene con fecha, así que nace agendado.
      estado: ev.fechaCorta ? "agendado" : "pendiente",
      fecha: ev.fechaCorta ?? undefined,
    });
    if (id === null) return; // la base rechazó la creación: no se marca como traído
    setTraidos(new Set(traidos).add(ev.idEvento));
    // Si el estampado falla, la tarea igual quedó creada; sólo no queda vinculada.
    try {
      await fetch("/api/google/vincular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idEvento: ev.idEvento, idTarea: id }),
      });
    } catch {
      /* sin vínculo: se puede reintentar en la próxima sincronización */
    }
  };

  return (
    <div className="mb-5">
      <button
        onClick={sincronizar}
        disabled={cargando}
        className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-50"
      >
        {cargando ? "Leyendo el calendario…" : "🔄 Traer del calendario"}
      </button>

      {error && (
        <p className="mt-2 rounded-xl bg-red-500/15 px-3 py-2 text-[11px] text-red-200">{error}</p>
      )}

      {divergencias?.length === 0 && (
        <div className="mt-2 rounded-xl bg-emerald-500/15 px-3 py-2 text-[11px] text-emerald-100">
          ✓ Revisé <strong>{revisados}</strong> evento{revisados === 1 ? "" : "s"} del calendario
          {sueltos !== null && ` y ${sueltos.length} cargado${sueltos.length === 1 ? "" : "s"} a mano`}.
          Nada que reconciliar.
          {huerfanos > 0 && (
            <span className="mt-1 block text-emerald-200/70">
              {huerfanos} apuntan a tareas que ya no existen en el tablero — se ignoran.
            </span>
          )}
          {revisados === 0 && (
            <span className="mt-1 block text-emerald-200/70">
              Para probarlo: agendá una tarea desde su tarjeta, movela de día en Google
              Calendar, y volvé a apretar acá.
            </span>
          )}
        </div>
      )}

      {divergencias && divergencias.length > 0 && (
        <div className="sombra-3d mt-2 space-y-2 rounded-[20px] bg-white/95 p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            {divergencias.length} diferencia{divergencias.length === 1 ? "" : "s"} entre el calendario y el tablero
          </p>

          {divergencias.map((d) => {
            const clave = `${d.idTarea}-${d.tipo}`;
            if (resueltas.has(clave)) return null;
            return (
              <div
                key={clave}
                className="rounded-xl bg-slate-50 p-3"
                style={{ borderLeft: `3px solid ${COLOR[d.tipo]}` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-bold text-slate-800">{d.empresa}</p>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase text-white"
                    style={{ backgroundColor: COLOR[d.tipo] }}
                  >
                    {ETIQUETA[d.tipo]}
                  </span>
                </div>
                <p className="truncate text-[11px] text-slate-500">{d.tema}</p>
                <p className="mt-1 text-[11px] text-slate-600">{d.detalle}</p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {d.tipo === "movido" && d.fechaNueva && (
                    <button
                      onClick={() => {
                        asignarFecha(d.idTarea, d.fechaNueva!);
                        marcar(clave);
                      }}
                      className="rounded-lg bg-[#3b5bfd] px-3 py-1 text-[11px] font-semibold text-white transition hover:opacity-90"
                    >
                      Usar {d.fechaNueva}
                    </button>
                  )}
                  {d.tipo === "cancelado" && (
                    <button
                      onClick={() => {
                        asignarFecha(d.idTarea, "");
                        marcar(clave);
                      }}
                      className="rounded-lg bg-[#3b5bfd] px-3 py-1 text-[11px] font-semibold text-white transition hover:opacity-90"
                    >
                      Quitar la fecha de la tarjeta
                    </button>
                  )}
                  {d.tipo === "ocurrio" && (
                    <button
                      onClick={() => {
                        moverTarea(d.idTarea, "listo");
                        marcar(clave);
                      }}
                      className="rounded-lg bg-[#12b3a8] px-3 py-1 text-[11px] font-semibold text-white transition hover:opacity-90"
                    >
                      Sí, marcar Listo
                    </button>
                  )}
                  <button
                    onClick={() => marcar(clave)}
                    className="text-[11px] text-slate-400 transition hover:text-slate-700"
                  >
                    dejar como está
                  </button>
                  {d.link && (
                    <a
                      href={d.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold text-[#3b5bfd] underline"
                    >
                      ver evento
                    </a>
                  )}
                </div>
              </div>
            );
          })}

        </div>
      )}

      {/* Lo que está en el calendario y el tablero no conoce. */}
      {sueltos && sueltos.length > 0 && (
        <div className="sombra-3d mt-2 rounded-[20px] bg-white/95 p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            En el calendario pero no en el tablero ({sueltos.filter((s) => !traidos.has(s.idEvento)).length})
          </p>
          <p className="mb-2 text-[10px] text-slate-500">
            Eventos que cargaste a mano en Google. Al traerlos, el tablero les deja
            su marca y quedan emparejados para siempre.
          </p>
          <div className="space-y-2">
            {sueltos.map((ev) => {
              if (traidos.has(ev.idEvento)) return null;
              return (
                <div
                  key={ev.idEvento}
                  className="rounded-xl bg-slate-50 p-3"
                  style={{ borderLeft: "3px solid #6366f1" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold text-slate-800">{ev.titulo}</p>
                    {ev.fechaCorta && (
                      <span className="shrink-0 rounded-full bg-slate-500 px-2 py-0.5 text-[9px] font-bold text-white">
                        {ev.fechaCorta}
                        {ev.dias !== null &&
                          (ev.dias < 0
                            ? ` · hace ${-ev.dias} d`
                            : ev.dias === 0
                            ? " · HOY"
                            : ` · en ${ev.dias} d`)}
                      </span>
                    )}
                  </div>
                  {ev.descripcion && (
                    <p className="mt-1 line-clamp-2 text-[10px] text-slate-500">{ev.descripcion}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => traerAlTablero(ev)}
                      className="rounded-lg bg-[#6366f1] px-3 py-1 text-[11px] font-semibold text-white transition hover:opacity-90"
                    >
                      ⇩ Traer al tablero
                    </button>
                    <button
                      onClick={() => setTraidos(new Set(traidos).add(ev.idEvento))}
                      className="text-[11px] text-slate-400 transition hover:text-slate-700"
                    >
                      ignorar
                    </button>
                    {ev.link && (
                      <a
                        href={ev.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold text-[#3b5bfd] underline"
                      >
                        ver evento
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
