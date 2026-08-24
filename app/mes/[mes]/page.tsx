"use client";

// Subpágina de un mes: vista semanal (para Julio, como el planner original)
// + las tareas específicas del corte, clicables para comentar/adjuntar.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  colorCategoria,
  VISTA_MENSUAL,
  VISTA_SEMANAL_JULIO,
  type Estado,
} from "@/lib/datos";
import { usePlanner, type Tarea } from "@/lib/estado";
import { Donut } from "@/components/Donut";
import { ModalTarea } from "@/components/ModalTarea";
import { AgenteIA } from "@/components/AgenteIA";

const NOMBRES: Record<string, string> = { mayo: "Mayo", junio: "Junio", julio: "Julio" };

const GRUPOS_ESTADO: { clave: Estado; titulo: string; color: string }[] = [
  { clave: "pendiente", titulo: "Pendientes", color: "#f0a13a" },
  { clave: "agendado", titulo: "Agendadas", color: "#12b3a8" },
  { clave: "listo", titulo: "Listas", color: "#3b5bfd" },
];

export default function PaginaMes() {
  const params = useParams<{ mes: string }>();
  const { tareas } = usePlanner();
  const [tareaAbierta, setTareaAbierta] = useState<Tarea | null>(null);

  const id = (params.mes ?? "").toLowerCase();
  const nombre = NOMBRES[id];
  const resumen = VISTA_MENSUAL.find((m) => m.mes === nombre);
  const esJulio = id === "julio";
  const tareaModal = tareaAbierta
    ? tareas.find((t) => t.id === tareaAbierta.id) ?? null
    : null;

  if (!nombre || !resumen) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-lg text-white">Ese mes no existe en el planner.</p>
        <Link href="/" className="mt-4 inline-block rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900">
          ← Volver al tablero
        </Link>
      </main>
    );
  }

  const total = resumen.listo + resumen.enProceso + resumen.terminado;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
            aria-label="Volver"
          >
            ←
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {nombre} — detalle del mes
            </h1>
            <p className="text-sm text-slate-300/80">
              {resumen.estadoMes === "cerrado" ? "Mes cerrado" : "Mes en curso · a la fecha"}
            </p>
          </div>
        </div>
        <div className="sombra-3d-suave flex items-center gap-3 rounded-2xl bg-white px-5 py-3">
          <Donut listo={resumen.listo} enProceso={resumen.enProceso} terminado={resumen.terminado} tamano={56} />
          <div>
            <p className="text-xl font-bold tabular-nums text-slate-900">{total}</p>
            <p className="text-xs text-slate-400">pendientes</p>
          </div>
        </div>
      </header>

      {esJulio ? (
        <>
          {/* Vista semanal — Julio (como el planner original) */}
          <section className="mb-10">
            <div className="mb-1 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-lg backdrop-blur">📅</span>
              <h2 className="text-2xl font-bold tracking-tight text-white">
                Vista semanal — Julio 2026
              </h2>
            </div>
            <p className="mb-5 pl-[52px] text-sm text-slate-300/80">
              Pendientes nuevos registrados por semana, según tipo.
            </p>
            <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
              {VISTA_SEMANAL_JULIO.map((s, i) => {
                const tot = s.listo + s.enProceso + s.terminado;
                return (
                  <div
                    key={s.semana}
                    className={`flotar flotar-${(i % 4) + 1} sombra-3d rounded-[26px] bg-white p-5 text-center`}
                  >
                    <div className="relative mx-auto grid w-fit place-items-center">
                      <Donut listo={s.listo} enProceso={s.enProceso} terminado={s.terminado} tamano={110} />
                      <div className="absolute text-center">
                        <p
                          className="text-2xl font-bold tabular-nums"
                          style={{ color: s.enCurso ? "#3b5bfd" : "#1e293b" }}
                        >
                          {tot}
                        </p>
                        <p className="text-[10px] text-slate-400">pendientes</p>
                      </div>
                    </div>
                    <p
                      className="mt-2 font-semibold"
                      style={{ color: s.enCurso ? "#3b5bfd" : "#1e293b" }}
                    >
                      {s.semana}
                    </p>
                    <p className="text-xs text-slate-400">{s.rango}</p>
                    {s.enCurso && (
                      <span className="mt-1.5 inline-block rounded-full bg-[#e8edff] px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-[#3b5bfd]">
                        EN CURSO
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-slate-300/90">
              <span className="inline-block h-2 w-2 rounded-full bg-[#3b5bfd]" />
              <b className="text-white">Semana 1</b> concentra el mayor volumen (22) — el
              tipo con más peso ahí es <b className="text-white">En proceso</b> (10).
            </p>
          </section>

          {/* Tareas específicas del corte */}
          <section>
            <div className="mb-1 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-lg backdrop-blur">🗒️</span>
              <h2 className="text-2xl font-bold tracking-tight text-white">
                Tareas específicas (corte 17/07)
              </h2>
            </div>
            <p className="mb-5 pl-[52px] text-sm text-slate-300/80">
              Hacé clic en una tarea para ver el detalle, comentar o adjuntar archivos.
            </p>
            <div className="grid gap-5 md:grid-cols-3">
              {GRUPOS_ESTADO.map((g) => {
                const items = tareas.filter((t) => t.estado === g.clave);
                return (
                  <div key={g.clave} className="sombra-3d rounded-[26px] bg-white/95 p-4">
                    <div className="mb-3 flex items-center justify-between px-1">
                      <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                        {g.titulo}
                      </p>
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: g.color }}>
                        {items.length}
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      {items.map((t) => {
                        const c = colorCategoria(t.categoria);
                        return (
                          <button
                            key={t.id}
                            onClick={() => setTareaAbierta(t)}
                            className="sombra-3d-suave block w-full rounded-2xl p-3.5 text-left"
                            style={{ backgroundColor: c.fondo, border: `1px solid ${c.borde}` }}
                          >
                            <p className="text-sm font-bold" style={{ color: c.texto }}>
                              {t.empresa}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-600">{t.tema}</p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: c.punto }}>
                                {t.categoria}
                              </span>
                              {t.comentarios.length > 0 && (
                                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[#3b5bfd] ring-1 ring-slate-200">
                                  💬 {t.comentarios.length}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      ) : (
        <section className="sombra-3d mx-auto max-w-xl rounded-[26px] bg-white p-8 text-center">
          <div className="mx-auto w-fit">
            <Donut listo={resumen.listo} enProceso={resumen.enProceso} terminado={resumen.terminado} />
          </div>
          <p className="mt-4 text-lg font-bold text-slate-900">
            {nombre} cerró con {total} pendientes
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            El archivo actual (Agenda 17_07.xlsx) solo trae el detalle de tareas del
            corte vigente — no hay lista de tareas específicas de {nombre} para
            mostrar. Cuando cargues un archivo con histórico, este mes tendrá su
            propio detalle igual que Julio.
          </p>
          <Link
            href="/mes/julio"
            className="mt-5 inline-block rounded-full bg-[#3b5bfd] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Ver el detalle de Julio →
          </Link>
        </section>
      )}

      {tareaModal && <ModalTarea tarea={tareaModal} onCerrar={() => setTareaAbierta(null)} />}
      <AgenteIA />
    </main>
  );
}
