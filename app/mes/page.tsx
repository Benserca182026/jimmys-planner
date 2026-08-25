"use client";

// Calendario real del planner: rejilla mensual con navegación libre entre
// meses. Las tareas se pintan en su día real (campo `fecha`, interpretado con
// parsearFechaCorta — la misma regla que usa el tablero para los chips).
//
// Distinción visual, con la pauta de los chips de urgencia del tablero:
// · vencida (la fecha ya pasó y la tarea no está lista) → rojo
// · sin confirmar → ámbar
// · confirmada → verde azulado
// · lista → gris con ✓ (ya no apremia)
//
// Abajo queda SIEMPRE visible la zona de tareas sin fecha de la pestaña
// activa: son las candidatas a agendar — esconderlas sería negar que existen.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AGENDAS, colorCategoria } from "@/lib/datos";
import { usePlanner, type Tarea } from "@/lib/estado";
import { diasHasta, parsearFechaCorta } from "@/lib/deteccion";
import { ModalTarea } from "@/components/ModalTarea";
import { AgenteIA } from "@/components/AgenteIA";

const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

type Pestana = "todas" | (typeof AGENDAS)[number]["id"];

/** Cómo se pinta una tarea en el calendario, según su situación real. */
function estiloSituacion(t: Tarea, dias: number) {
  if (t.estado === "listo")
    return { clase: "bg-slate-100 text-slate-500 ring-slate-200", marca: "✓" };
  if (dias < 0) return { clase: "bg-red-50 text-red-700 ring-red-200", marca: "vencida" };
  if (t.confirmada === "Si")
    return { clase: "bg-emerald-50 text-emerald-700 ring-emerald-200", marca: "✓ confirmada" };
  return { clase: "bg-amber-50 text-amber-700 ring-amber-200", marca: "sin confirmar" };
}

export default function PaginaCalendario() {
  const { tareas } = usePlanner();
  const [tareaAbierta, setTareaAbierta] = useState<Tarea | null>(null);
  const [pestana, setPestana] = useState<Pestana>("todas");

  // La fecha de hoy se toma recién en el cliente (misma razón que el tablero:
  // el servidor podría estar en otro huso y el HTML no coincidiría).
  const [hoy, setHoy] = useState<Date | null>(null);
  // Mes visible: se inicializa en el mes actual, o en el ?m=YYYY-MM del enlace.
  const [cursor, setCursor] = useState<{ anio: number; mes0: number } | null>(null);

  useEffect(() => {
    const ahora = new Date();
    setHoy(ahora);
    const m = new URLSearchParams(window.location.search)
      .get("m")
      ?.match(/^(\d{4})-(\d{1,2})$/);
    if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
      setCursor({ anio: Number(m[1]), mes0: Number(m[2]) - 1 });
    } else {
      setCursor({ anio: ahora.getFullYear(), mes0: ahora.getMonth() });
    }
  }, []);

  const grupoActivo = AGENDAS.find((a) => a.id === pestana);
  const deLaPestana = useMemo(
    () => (grupoActivo ? tareas.filter((t) => t.agenda === grupoActivo.id) : tareas),
    [tareas, grupoActivo]
  );

  // Tareas con fecha interpretable, resueltas a día real de una vez.
  const conFecha = useMemo(() => {
    if (!hoy) return [];
    return deLaPestana.flatMap((t) => {
      const f = parsearFechaCorta(t.fecha, hoy);
      return f ? [{ tarea: t, fecha: f, dias: diasHasta(f, hoy) }] : [];
    });
  }, [deLaPestana, hoy]);

  // Candidatas a agendar: sin fecha (o con fecha ilegible) y todavía no listas.
  const sinFecha = useMemo(
    () =>
      deLaPestana.filter(
        (t) => t.estado !== "listo" && (!hoy || !parsearFechaCorta(t.fecha, hoy))
      ),
    [deLaPestana, hoy]
  );

  const tareaModal = tareaAbierta
    ? tareas.find((t) => t.id === tareaAbierta.id) ?? null
    : null;

  if (!hoy || !cursor) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-sm text-slate-300/80">Cargando el calendario…</p>
      </main>
    );
  }

  const { anio, mes0 } = cursor;
  const primerDia = new Date(anio, mes0, 1);
  const desplazamiento = (primerDia.getDay() + 6) % 7; // semana que arranca lunes
  const diasEnMes = new Date(anio, mes0 + 1, 0).getDate();
  const esMesDeHoy = anio === hoy.getFullYear() && mes0 === hoy.getMonth();
  const esJulio2026 = anio === 2026 && mes0 === 6;

  const porDia = new Map<number, typeof conFecha>();
  for (const item of conFecha) {
    if (item.fecha.getFullYear() !== anio || item.fecha.getMonth() !== mes0) continue;
    const d = item.fecha.getDate();
    porDia.set(d, [...(porDia.get(d) ?? []), item]);
  }
  const enEsteMes = [...porDia.values()].reduce((n, v) => n + v.length, 0);

  const mover = (delta: number) => {
    const f = new Date(anio, mes0 + delta, 1);
    setCursor({ anio: f.getFullYear(), mes0: f.getMonth() });
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
            aria-label="Volver al tablero"
          >
            ←
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              🗓️ Calendario — {NOMBRES_MES[mes0]} {anio}
            </h1>
            <p className="text-sm text-slate-300/80">
              {enEsteMes === 0
                ? "Sin tareas fechadas en este mes"
                : `${enEsteMes} tarea${enEsteMes === 1 ? "" : "s"} fechada${enEsteMes === 1 ? "" : "s"} en este mes`}
              {" · clic en una tarea abre su detalle"}
            </p>
          </div>
        </div>

        {/* Navegación libre entre meses */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => mover(-1)}
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
            aria-label="Mes anterior"
          >
            ← Anterior
          </button>
          <button
            onClick={() => setCursor({ anio: hoy.getFullYear(), mes0: hoy.getMonth() })}
            disabled={esMesDeHoy}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              esMesDeHoy
                ? "cursor-default bg-white/5 text-white/40"
                : "bg-white text-slate-900 shadow-lg hover:opacity-90"
            }`}
          >
            Hoy
          </button>
          <button
            onClick={() => mover(1)}
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
            aria-label="Mes siguiente"
          >
            Siguiente →
          </button>
        </div>
      </header>

      {/* Pestañas por agenda — mismas que el tablero */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setPestana("todas")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            pestana === "todas"
              ? "bg-white text-slate-900 shadow-lg"
              : "border border-white/20 bg-white/10 text-white backdrop-blur hover:bg-white/20"
          }`}
        >
          Todas ({tareas.length})
        </button>
        {AGENDAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setPestana(a.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              pestana === a.id
                ? "bg-white text-slate-900 shadow-lg"
                : "border border-white/20 bg-white/10 text-white backdrop-blur hover:bg-white/20"
            }`}
          >
            <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: a.color }} />
            {a.nombre} ({tareas.filter((t) => t.agenda === a.id).length})
          </button>
        ))}
        {esJulio2026 && (
          <Link
            href="/mes/julio"
            className="ml-auto rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            📅 Vista semanal de Julio →
          </Link>
        )}
      </div>

      {/* Leyenda de situaciones */}
      <div className="mb-4 flex flex-wrap gap-2 text-[11px]">
        <span className="rounded-full bg-red-50 px-2.5 py-1 font-semibold text-red-700 ring-1 ring-red-200">vencida</span>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700 ring-1 ring-amber-200">sin confirmar</span>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 ring-1 ring-emerald-200">✓ confirmada</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-500 ring-1 ring-slate-200">✓ lista</span>
      </div>

      {/* Rejilla mensual */}
      <section className="sombra-3d overflow-x-auto rounded-[26px] bg-white/95 p-4">
        <div className="min-w-[720px]">
          <div className="mb-2 grid grid-cols-7 gap-2">
            {DIAS_SEMANA.map((d) => (
              <p key={d} className="px-2 text-center text-xs font-bold uppercase tracking-wide text-slate-400">
                {d}
              </p>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: desplazamiento }).map((_, i) => (
              <div key={`v-${i}`} className="min-h-[92px] rounded-xl bg-slate-50/60" />
            ))}
            {Array.from({ length: diasEnMes }).map((_, i) => {
              const dia = i + 1;
              const esHoy = esMesDeHoy && dia === hoy.getDate();
              const delDia = porDia.get(dia) ?? [];
              return (
                <div
                  key={dia}
                  className={`min-h-[92px] rounded-xl border p-1.5 ${
                    esHoy
                      ? "border-[#3b5bfd] bg-[#e8edff] ring-2 ring-[#3b5bfd]/30"
                      : "border-slate-100 bg-white"
                  }`}
                >
                  <p
                    className={`mb-1 text-right text-xs font-bold tabular-nums ${
                      esHoy ? "text-[#3b5bfd]" : "text-slate-400"
                    }`}
                  >
                    {esHoy ? `HOY · ${dia}` : dia}
                  </p>
                  <div className="space-y-1">
                    {delDia.map(({ tarea: t, dias }) => {
                      const c = colorCategoria(t.categoria);
                      const s = estiloSituacion(t, dias);
                      return (
                        <button
                          key={t.id}
                          onClick={() => setTareaAbierta(t)}
                          title={`${t.empresa} — ${t.tema} (${s.marca})`}
                          className={`block w-full rounded-lg px-1.5 py-1 text-left text-[10px] leading-tight ring-1 transition hover:brightness-95 ${s.clase}`}
                        >
                          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ backgroundColor: c.punto }} />
                          <span className="font-bold">{t.empresa}</span>
                          <span className="block truncate opacity-80">{t.tema}</span>
                          <span className="font-semibold">{s.marca}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Zona de candidatas a agendar — visible siempre, no se esconde */}
      <section className="mt-8">
        <div className="mb-1 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-lg backdrop-blur">📌</span>
          <h2 className="text-xl font-bold tracking-tight text-white">
            Sin fecha — candidatas a agendar ({sinFecha.length})
          </h2>
        </div>
        <p className="mb-4 pl-[52px] text-sm text-slate-300/80">
          Tareas de {grupoActivo ? grupoActivo.nombre : "todas las agendas"} que
          todavía no tienen día en el calendario. Clic para abrir y asignarles fecha.
        </p>
        {sinFecha.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/20 px-4 py-6 text-center text-sm text-slate-300/70">
            Todas las tareas de esta pestaña ya tienen fecha o están listas.
          </p>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {sinFecha.map((t) => {
              const c = colorCategoria(t.categoria);
              return (
                <button
                  key={t.id}
                  onClick={() => setTareaAbierta(t)}
                  className="sombra-3d-suave rounded-2xl p-3 text-left transition hover:brightness-95"
                  style={{ backgroundColor: c.fondo, border: `1px solid ${c.borde}` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold" style={{ color: c.texto }}>
                      {t.empresa}
                    </p>
                    {t.prioridad === "Urgente" && (
                      <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                        Urgente
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600">{t.tema}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: c.punto }}>
                      {t.categoria}
                    </span>
                    {t.fecha && (
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
                        fecha ilegible: “{t.fecha}”
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {tareaModal && <ModalTarea tarea={tareaModal} onCerrar={() => setTareaAbierta(null)} />}
      <AgenteIA />
    </main>
  );
}
