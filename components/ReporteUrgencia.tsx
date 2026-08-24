"use client";

// Reporte de urgencia que asoma al pasar el mouse por el encabezado de una
// columna. No es una zona fija del tablero: aparece donde estás mirando, se
// calcula sobre las tareas DE ESA COLUMNA y desaparece al salir.
//
// Las dos capas, en el mismo orden de siempre:
//   1) regla programada — score + fechas escondidas en el texto. Instantáneo.
//   2) IA — botón aparte, no puntúa ni reordena, sólo trae datos con cita.

import { useMemo, useState } from "react";
import { COLORES_CATEGORIA } from "@/lib/datos";
import { detectarFechasOcultas, diasHasta, parsearFechaCorta } from "@/lib/deteccion";
import { usePlanner, type Tarea } from "@/lib/estado";

interface HallazgoIA {
  tipo?: string;
  empresa?: string;
  cita?: string;
  hallazgo?: string;
  propuesta?: string;
}

const CLAVE_API = "jp_api_key";

// ── ORDEN POR VENCIMIENTO, NO POR PUNTOS ──
//
// Se abandonó la suma de puntos porque permitía compensación: muchas señales
// blandas terminaban desplazando a un compromiso que vence mañana. Ahora hay
// cuatro bandas jerárquicas, y nada de una banda inferior puede saltar a la de
// arriba por acumulación. Dentro de cada banda ordena el tiempo.

type Banda = "vencida" | "semana" | "urgenteSinFecha" | "comprometida" | "sinPlazo";

// El orden de las bandas ES la jerarquía. Nótese dónde entra la voluntad
// declarada: un "Urgente" que vos marcaste vence a un compromiso lejano —
// no tiene plazo, pero justamente por eso hay que ponerle uno ya. Sin esta
// banda, marcar Urgente no movía nada y la prioridad quedaba muerta.
const BANDAS: { clave: Banda; titulo: string; color: string }[] = [
  { clave: "vencida", titulo: "Vencidas", color: "#dc2626" },
  { clave: "semana", titulo: "Vencen esta semana", color: "#f0a13a" },
  { clave: "urgenteSinFecha", titulo: "Urgentes sin fecha — agendar ya", color: "#dc2626" },
  { clave: "comprometida", titulo: "Comprometidas", color: "#12b3a8" },
  { clave: "sinPlazo", titulo: "Sin plazo", color: "#94a3b8" },
];

const PESO_PRIORIDAD: Record<string, number> = { Urgente: 0, A: 1 };

interface Clasificada {
  t: Tarea;
  banda: Banda;
  dias: number | null;
}

function clasificar(tareas: Tarea[], hoy: Date): Clasificada[] {
  return tareas.map((t) => {
    const f = parsearFechaCorta(t.fecha, hoy);
    if (!f) {
      const banda: Banda = t.prioridad === "Urgente" ? "urgenteSinFecha" : "sinPlazo";
      return { t, banda, dias: null };
    }
    const dias = diasHasta(f, hoy);
    const banda: Banda = dias < 0 ? "vencida" : dias <= 7 ? "semana" : "comprometida";
    return { t, banda, dias };
  });
}

/** Dentro de una banda: primero lo que antes vence; sin plazo, manda la prioridad. */
function ordenarDentro(a: Clasificada, b: Clasificada): number {
  if (a.dias !== null && b.dias !== null) return a.dias - b.dias;
  const pa = PESO_PRIORIDAD[a.t.prioridad ?? ""] ?? 2;
  const pb = PESO_PRIORIDAD[b.t.prioridad ?? ""] ?? 2;
  return pa - pb;
}

const textoDias = (d: number) =>
  d < 0
    ? `venció hace ${-d} día${-d === 1 ? "" : "s"}`
    : d === 0
    ? "vence HOY"
    : d === 1
    ? "vence mañana"
    : `en ${d} días`;

export function ReporteUrgencia({
  tareasColumna,
  titulo,
  color,
  hoy,
  pegajoso = true,
}: {
  tareasColumna: Tarea[];
  titulo: string;
  color: string;
  hoy: Date;
  /** En el carril lateral queda fijo al hacer scroll; embebido en la columna, no. */
  pegajoso?: boolean;
}) {
  const { tareas, asignarFecha } = usePlanner();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hallazgosIA, setHallazgosIA] = useState<HallazgoIA[] | null>(null);

  const ocultas = useMemo(() => detectarFechasOcultas(tareasColumna, hoy), [tareasColumna, hoy]);
  const porBanda = useMemo(() => {
    const todas = clasificar(tareasColumna, hoy);
    return BANDAS.map((b) => ({
      ...b,
      items: todas.filter((c) => c.banda === b.clave).sort(ordenarDentro),
    })).filter((b) => b.items.length > 0);
  }, [tareasColumna, hoy]);

  const buscarConIA = async () => {
    setCargando(true);
    setError(null);
    try {
      const apiKey = window.localStorage.getItem(CLAVE_API) || undefined;
      const res = await fetch("/api/analizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modo: "hallazgos",
          apiKey,
          tareas: tareasColumna.map((t) => ({
            empresa: t.empresa, tema: t.tema, categoria: t.categoria,
            estado: t.estado, prioridad: t.prioridad ?? undefined,
            fecha: t.fecha, confirmada: t.confirmada, involucrados: t.involucrados,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.mensaje ?? "No se pudo consultar."); return; }
      setHallazgosIA(data.hallazgos ?? []);
    } catch {
      setError("No se pudo contactar la API.");
    } finally {
      setCargando(false);
    }
  };

  return (
    // Vive en su propio carril a la derecha del tablero: no se monta sobre
    // ninguna columna. Queda pegado arriba mientras se hace scroll.
    <div className={pegajoso ? "sticky top-4" : ""}>
      <div className="asomar-lateral max-h-[75vh] overflow-y-auto rounded-[20px] bg-white p-3.5 shadow-2xl ring-1 ring-black/10">
        <div className="mb-2 flex items-center gap-2">
          <span
            className="grid h-7 w-7 place-items-center rounded-lg text-sm"
            style={{ backgroundColor: `${color}22` }}
          >
            🎯
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold" style={{ color }}>
              Urgencia · {titulo}
            </p>
            <p className="text-[10px] text-slate-400">
              {tareasColumna.length} tarea{tareasColumna.length === 1 ? "" : "s"} · calculado por reglas
            </p>
          </div>
        </div>

        {tareasColumna.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-[11px] text-slate-400">
            Nada en esta columna.
          </p>
        ) : (
          <>
            {/* ── Capa 1: orden por vencimiento, en bandas ── */}
            <div className="space-y-2.5">
              {porBanda.map((b) => (
                <div key={b.clave}>
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: b.color }} />
                    <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: b.color }}>
                      {b.titulo}
                    </span>
                    <span className="text-[10px] text-slate-400">({b.items.length})</span>
                  </div>
                  <div className="space-y-1">
                    {b.items.slice(0, 4).map((c, i) => {
                      const col = COLORES_CATEGORIA[c.t.categoria];
                      return (
                        <div
                          key={c.t.id}
                          className="flex items-start gap-2 rounded-lg px-1.5 py-1"
                          style={{ backgroundColor: i === 0 ? col.fondo : "transparent" }}
                        >
                          <span
                            className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-bold text-white"
                            style={{ backgroundColor: col.punto }}
                          >
                            {i + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[11px] font-bold text-slate-800">
                              {c.t.empresa}
                              <span className="ml-1 font-normal text-slate-400">· {c.t.categoria}</span>
                              {c.t.prioridad && (
                                <span
                                  className="ml-1.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase text-white"
                                  style={{
                                    backgroundColor:
                                      c.t.prioridad === "Urgente" ? "#dc2626" : "#f59e0b",
                                  }}
                                >
                                  {c.t.prioridad === "Urgente" ? "urgente" : "prio A"}
                                </span>
                              )}
                            </span>
                            <span className="block text-[10px] leading-snug text-slate-600">
                              {c.t.tema}
                            </span>
                          </span>
                          <span
                            className="shrink-0 whitespace-nowrap text-[10px] font-bold"
                            style={{ color: c.dias !== null ? b.color : "#94a3b8" }}
                          >
                            {c.dias !== null
                              ? textoDias(c.dias)
                              : c.t.prioridad
                              ? c.t.prioridad === "Urgente"
                                ? "URGENTE"
                                : "prioridad A"
                              : "—"}
                          </span>
                        </div>
                      );
                    })}
                    {b.items.length > 4 && (
                      <p className="pl-1.5 text-[10px] text-slate-400">
                        y {b.items.length - 4} más
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
              Ordena el vencimiento, no un puntaje. Nada de una banda inferior puede
              adelantarse a la de arriba. Sin plazo, manda la prioridad que marcaste.
            </p>

            {/* ── Capa 1b: fechas escritas en el texto, que el score no puede leer ── */}
            {ocultas.length > 0 && (
              <div className="mt-2.5 rounded-xl border-l-[3px] border-amber-400 bg-amber-50/60 p-2.5">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                  Fecha escrita en el texto · sin cargar
                </p>
                <div className="space-y-2">
                  {ocultas.slice(0, 3).map((h) => (
                    <FilaFecha
                      key={h.idTarea}
                      empresa={h.empresa}
                      tema={h.tema}
                      cita={h.cita}
                      etiqueta={h.etiqueta}
                      dias={h.dias}
                      esMes={h.precision === "mes"}
                      onAplicar={() => asignarFecha(h.idTarea, h.etiqueta)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Capa 2: IA, separada y subordinada ── */}
            <div className="mt-2.5 border-t border-slate-100 pt-2.5">
              <button
                onClick={buscarConIA}
                disabled={cargando}
                className="w-full rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {cargando ? "Leyendo el texto…" : "🔎 Buscar lo que la regla no ve"}
              </button>

              {error && (
                <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-[10px] text-red-700">
                  {error} — cargá la clave desde el menú del agente (⚙).
                </p>
              )}
              {hallazgosIA?.length === 0 && (
                <p className="mt-2 text-[10px] text-slate-400">
                  Nada verificable. La regla ya veía todo lo que hay.
                </p>
              )}
              {hallazgosIA && hallazgosIA.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {hallazgosIA.map((h, i) => (
                    <div key={i} className="rounded-lg bg-slate-50 p-2">
                      <p className="text-[11px] font-bold text-slate-800">
                        {h.empresa}
                        {h.tipo && (
                          <span className="ml-1.5 rounded bg-slate-200 px-1 text-[9px] uppercase text-slate-600">
                            {h.tipo}
                          </span>
                        )}
                      </p>
                      {h.cita && (
                        <p className="mt-1 border-l-2 border-slate-300 pl-1.5 text-[10px] italic text-slate-500">
                          “{h.cita}”
                        </p>
                      )}
                      {h.hallazgo && <p className="mt-1 text-[10px] text-slate-700">{h.hallazgo}</p>}
                      {h.propuesta && <p className="text-[10px] text-[#3b5bfd]">➡ {h.propuesta}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FilaFecha({
  empresa, tema, cita, etiqueta, dias, esMes, onAplicar,
}: {
  empresa: string; tema: string; cita: string; etiqueta: string;
  dias: number; esMes: boolean; onAplicar: () => void;
}) {
  const [listo, setListo] = useState(false);
  const apremia = dias >= 0 && dias <= 10;
  return (
    <div>
      <div className="flex items-start justify-between gap-1.5">
        <p className="text-[11px] font-bold text-slate-800">{empresa}</p>
        <span
          className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white"
          style={{ backgroundColor: apremia ? "#dc2626" : "#94a3b8" }}
        >
          {esMes ? `mes ${etiqueta}` : etiqueta} · {textoDias(dias)}
        </span>
      </div>
      <p className="truncate text-[10px] text-slate-500">{tema}</p>
      <p className="text-[9px] text-slate-400">
        de <span className="rounded bg-amber-100 px-1 font-mono text-amber-800">{cita}</span>
      </p>
      {listo ? (
        <p className="mt-1 text-[10px] font-semibold text-emerald-600">✓ cargada — ranking recalculado</p>
      ) : (
        <button
          onClick={() => { onAplicar(); setListo(true); }}
          className="mt-1 rounded bg-[#3b5bfd] px-2 py-0.5 text-[10px] font-semibold text-white transition hover:opacity-90"
        >
          Cargar {etiqueta}
        </button>
      )}
    </div>
  );
}
