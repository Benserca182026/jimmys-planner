"use client";

// Jimmy's Planner — dashboard interactivo.
// · Vista mensual arriba (clic en un mes → subpágina con sus tareas)
// · Kanban con drag & drop entre columnas y detalle de tarea (comentarios/archivos)
// · Subcategorías por color y pestañas por tipo de agenda
// · Agente IA flotante · animaciones flotantes y sombras 3D azules

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AGENDAS,
  COLORES_CATEGORIA,
  colorCategoria,
  VISTA_MENSUAL,
  type Categoria,
  type Estado,
} from "@/lib/datos";
import { usePlanner, type Tarea } from "@/lib/estado";
import { diasHasta, parsearFechaCorta } from "@/lib/deteccion";
import { Donut } from "@/components/Donut";
import { ModalTarea } from "@/components/ModalTarea";
import { AgenteIA } from "@/components/AgenteIA";
import { ReporteUrgencia } from "@/components/ReporteUrgencia";
import { SincronizarCalendario } from "@/components/SincronizarCalendario";

const COLUMNAS: { clave: Estado; titulo: string; color: string }[] = [
  { clave: "pendiente", titulo: "Pendiente", color: "#f0a13a" },
  { clave: "agendado", titulo: "Agendado", color: "#12b3a8" },
  { clave: "listo", titulo: "Listo", color: "#3b5bfd" },
];


/** Agrupa las tarjetas de una columna por categoría, en el orden fijo del catálogo. */
const ORDEN_CATEGORIAS = Object.keys(COLORES_CATEGORIA) as Categoria[];
function agrupar(items: Tarea[]): [Categoria, Tarea[]][] {
  return ORDEN_CATEGORIAS.map(
    (c) => [c, items.filter((t) => t.categoria === c)] as [Categoria, Tarea[]]
  ).filter(([, del]) => del.length > 0);
}

const ID_MES: Record<string, string> = { Mayo: "mayo", Junio: "junio", Julio: "julio" };

type Pestana = "pendientes" | (typeof AGENDAS)[number]["id"];

export default function PaginaPlanner() {
  const router = useRouter();
  const { tareas, moverTarea, conectado, error: errorBase } = usePlanner();
  const [pestana, setPestana] = useState<Pestana>("pendientes");
  const [filtroCategoria, setFiltroCategoria] = useState<Categoria | null>(null);
  // Búsqueda libre sobre el tablero: empresa, tema o involucrados.
  const [busqueda, setBusqueda] = useState("");
  const [tareaAbierta, setTareaAbierta] = useState<Tarea | null>(null);
  const [columnaSobre, setColumnaSobre] = useState<Estado | null>(null);
  // Columna cuyo encabezado tiene el mouse encima: ahí asoma el reporte.
  const [reporteEn, setReporteEn] = useState<Estado | null>(null);
  // Grupos ABIERTOS dentro de las columnas, por clave "estado:categoría".
  // Arranca vacío a propósito: al abrir la página todo está contraído, y no se
  // guarda nada — desplegar es algo del momento, no una preferencia que se arrastre.
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  // La fecha de hoy se toma recién en el cliente: si se calculara al renderizar
  // en el servidor, "faltan 7 días" podría diferir entre servidor y navegador.
  const [hoy, setHoy] = useState<Date | null>(null);
  useEffect(() => setHoy(new Date()), []);

  const alternarGrupo = (clave: string) => {
    const s = new Set(abiertos);
    if (s.has(clave)) s.delete(clave);
    else s.add(clave);
    setAbiertos(s);
  };

  const grupoActivo = AGENDAS.find((a) => a.id === pestana);

  // Base del tablero: todas las tareas, o solo las de la agenda elegida.
  const deLaPestana = useMemo(
    () => (grupoActivo ? tareas.filter((t) => t.agenda === grupoActivo.id) : tareas),
    [tareas, grupoActivo]
  );

  const categorias = useMemo(
    () => [...new Set(deLaPestana.map((t) => t.categoria))] as Categoria[],
    [deLaPestana]
  );
  const q = busqueda.trim().toLowerCase();
  const visibles = (filtroCategoria
    ? deLaPestana.filter((t) => t.categoria === filtroCategoria)
    : deLaPestana
  ).filter(
    (t) =>
      q === "" ||
      t.empresa.toLowerCase().includes(q) ||
      t.tema.toLowerCase().includes(q) ||
      (t.involucrados ?? "").toLowerCase().includes(q)
  );

  // Claves de todos los grupos visibles ahora, para el botón de contraer/desplegar todo.
  const clavesDeGrupos = useMemo(
    () =>
      COLUMNAS.flatMap((col) =>
        agrupar(visibles.filter((t) => t.estado === col.clave)).map(
          ([cat]) => `${col.clave}:${cat}`
        )
      ),
    [visibles]
  );
  const hayAlgunGrupoAbierto = clavesDeGrupos.some((k) => abiertos.has(k));
  const columnaDelReporte = COLUMNAS.find((c) => c.clave === reporteEn);

  const tareaModal = tareaAbierta
    ? tareas.find((t) => t.id === tareaAbierta.id) ?? null
    : null;

  const salir = async () => {
    await fetch("/api/login", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  };

  const soltarEn = (estado: Estado, e: React.DragEvent) => {
    e.preventDefault();
    setColumnaSobre(null);
    const id = Number(e.dataTransfer.getData("text/plain"));
    if (!Number.isNaN(id)) moverTarea(id, estado);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Encabezado tipo hero */}
      <header className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#8ea2ff]">
            Panel interno
          </p>
          <h1 className="mt-2 bg-gradient-to-r from-white via-white to-[#aab8ff] bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-6xl">
            Jimmy&apos;s Planner
          </h1>
          <p className="mt-3 max-w-md text-base text-slate-400">
            Vista semanal del mes en curso y vista mensual de los últimos 3 meses.
          </p>
        </div>
        <button
          onClick={salir}
          className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20"
        >
          Cerrar sesión
        </button>
      </header>

      {/* Estado de la base: si algo no se guardó, hay que decirlo, no callarlo. */}
      {conectado === false && (
        <div className="mb-6 rounded-2xl border border-amber-400/40 bg-amber-500/15 px-4 py-3 text-sm text-amber-100">
          ⚠ Sin conexión con la base — estás viendo los datos originales del Excel y
          <strong> los cambios no se están guardando</strong>.
          {errorBase && <span className="mt-1 block text-[11px] opacity-80">{errorBase}</span>}
        </div>
      )}
      {conectado === true && errorBase && (
        <div className="mb-6 rounded-2xl border border-red-400/40 bg-red-500/15 px-4 py-3 text-sm text-red-100">
          {errorBase}
        </div>
      )}

      {/* ── 1. VISTA MENSUAL — clic en un mes abre su subpágina ── */}
      <section className="mb-10">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-lg backdrop-blur">🗂️</span>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Vista mensual — últimos 3 meses
          </h2>
          <Link
            href="/mes"
            className="ml-auto rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            🗓️ Abrir calendario →
          </Link>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          {VISTA_MENSUAL.map((m, i) => {
            const total = m.listo + m.enProceso + m.terminado;
            return (
              <div key={m.mes} className={`flotar flotar-${i + 1}`}>
              <Link
                href={`/mes/${ID_MES[m.mes]}`}
                className="sombra-3d block rounded-[26px] bg-white p-6 text-center outline-none focus-visible:ring-4 focus-visible:ring-[#3b5bfd]/40"
              >
                <div className="relative mx-auto grid w-fit place-items-center">
                  <Donut listo={m.listo} enProceso={m.enProceso} terminado={m.terminado} />
                  <div className="absolute text-center">
                    <p
                      className="text-3xl font-bold tabular-nums"
                      style={{ color: m.enCurso ? "#3b5bfd" : "#1e293b" }}
                    >
                      {total}
                    </p>
                    <p className="text-xs text-slate-400">pendientes</p>
                  </div>
                </div>
                <p
                  className="mt-3 text-lg font-semibold"
                  style={{ color: m.enCurso ? "#3b5bfd" : "#1e293b" }}
                >
                  {m.mes}
                </p>
                <p className="text-sm text-slate-400">{m.estadoMes}</p>
                {m.enCurso && (
                  <span className="mt-2 inline-block rounded-full bg-[#e8edff] px-3 py-1 text-xs font-bold tracking-wide text-[#3b5bfd]">
                    EN CURSO
                  </span>
                )}
                <p className="mt-3 text-xs font-semibold text-[#3b5bfd]">
                  Ver tareas →
                </p>
              </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 2. TABLERO KANBAN interactivo ── */}
      <section>
        <div className="mb-1 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-lg backdrop-blur">📋</span>
          <h2 className="text-2xl font-bold tracking-tight text-white">Tablero de agendas</h2>
        </div>
        <p className="mb-5 pl-[52px] text-sm text-slate-300/80">
          Arrastrá tarjetas entre columnas o hacé clic para comentar y adjuntar archivos.
          <span className="mt-1 block lg:hidden">
            En el celular no se arrastra: tocá la tarjeta y cambiale el estado desde
            adentro. Y tocá el nombre de la columna para ver su urgencia.
          </span>
        </p>

        {/* La vuelta del calendario: muestra diferencias, no las aplica sola. */}
        <SincronizarCalendario />

        {/* Pestañas por tipo de agenda */}
        <div className="mb-5 flex flex-wrap gap-2">
          <button
            onClick={() => {
              setPestana("pendientes");
              setFiltroCategoria(null);
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              pestana === "pendientes"
                ? "bg-white text-slate-900 shadow-lg"
                : "border border-white/20 bg-white/10 text-white backdrop-blur hover:bg-white/20"
            }`}
          >
            Pendientes 17/07 ({tareas.length})
          </button>
          {AGENDAS.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                setPestana(a.id);
                setFiltroCategoria(null);
              }}
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
        </div>

        {/* El tablero es el mismo en todas las pestañas: solo cambia el conjunto
            de tarjetas (todas, o las de la agenda elegida). */}
        <>
            {/* Buscador del tablero: filtra las tarjetas mientras escribís.
                Con búsqueda activa los grupos se muestran abiertos — de nada
                sirve encontrar si el hallazgo queda plegado. */}
            <div className="mb-3 flex max-w-sm items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur">
              <span className="text-sm text-white/60">🔎</span>
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar empresa, tema o persona…"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/40"
              />
              {busqueda !== "" && (
                <button
                  onClick={() => setBusqueda("")}
                  className="shrink-0 text-sm text-white/60 transition hover:text-white"
                  aria-label="Limpiar búsqueda"
                >
                  ✕
                </button>
              )}
            </div>
            {q !== "" && (
              <p className="mb-3 text-xs text-slate-300/80">
                {visibles.length === 0
                  ? "Ninguna tarjeta coincide con la búsqueda."
                  : `${visibles.length} tarjeta${visibles.length === 1 ? "" : "s"} coincide${visibles.length === 1 ? "" : "n"}.`}
              </p>
            )}

            {/* Leyenda de subcategorías por color (filtra al hacer clic) */}
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <button
                onClick={() =>
                  setAbiertos(hayAlgunGrupoAbierto ? new Set() : new Set(clavesDeGrupos))
                }
                className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                {hayAlgunGrupoAbierto ? "▾ Contraer todo" : "▸ Desplegar todo"}
              </button>
              <span className="mr-1 h-4 w-px bg-white/20" />
              {categorias.map((c) => {
                const col = colorCategoria(c);
                const activa = filtroCategoria === c;
                return (
                  <button
                    key={c}
                    onClick={() => setFiltroCategoria(activa ? null : c)}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition"
                    style={{
                      backgroundColor: activa ? col.punto : "rgba(255,255,255,0.1)",
                      color: activa ? "#fff" : "rgba(255,255,255,0.85)",
                      border: `1px solid ${activa ? col.punto : "rgba(255,255,255,0.2)"}`,
                    }}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: activa ? "#fff" : col.punto }}
                    />
                    {c} ({deLaPestana.filter((t) => t.categoria === c).length})
                  </button>
                );
              })}
            </div>

            {/* El reporte no se monta sobre el tablero: el tablero le cede
                ancho. Se cierra al salir de toda esta zona, no al pasar de una
                columna a otra. */}
            <div
              className="flex gap-5"
              // Sólo el mouse cierra al salir. Con el dedo no existe "salir":
              // se cierra tocando de nuevo el encabezado.
              onPointerLeave={(e) => {
                if (e.pointerType === "mouse") setReporteEn(null);
              }}
            >
            <div className="grid min-w-0 flex-1 gap-5 md:grid-cols-3">
              {COLUMNAS.map((col) => {
                const items = visibles.filter((t) => t.estado === col.clave);
                return (
                  <div
                    key={col.clave}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setColumnaSobre(col.clave);
                    }}
                    onDragLeave={() => setColumnaSobre(null)}
                    onDrop={(e) => soltarEn(col.clave, e)}
                    className={`sombra-3d rounded-[26px] bg-white/95 p-4 ${
                      columnaSobre === col.clave ? "zona-soltar" : ""
                    }`}
                  >
                    {/* El encabezado abre el reporte de ESTA columna: con el mouse
                        al pasarle por encima, con el dedo al tocarlo. El clic va
                        SÓLO en el encabezado — si estuviera en el contenedor, tocar
                        un botón del reporte lo cerraría al subir el evento. */}
                    <div
                      // Al tocar en un celular el navegador simula "mouse encima"
                      // y después dispara el clic: eso abría y cerraba el reporte
                      // en el mismo toque. Por eso el hover se limita al mouse real.
                      onPointerEnter={(e) => {
                        if (e.pointerType === "mouse") setReporteEn(col.clave);
                      }}
                    >
                      <div
                        onClick={() =>
                          setReporteEn(reporteEn === col.clave ? null : col.clave)
                        }
                        className="mb-3 flex cursor-pointer select-none items-center justify-between rounded-lg px-1 py-0.5 transition"
                        style={
                          reporteEn === col.clave
                            ? { backgroundColor: `${col.color}1a` }
                            : undefined
                        }
                      >
                        <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                          {col.titulo}
                          <span className="text-[10px] font-normal text-slate-400">🎯 urgencia</span>
                        </p>
                        <span
                          className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                          style={{ backgroundColor: col.color }}
                        >
                          {items.length}
                        </span>
                      </div>

                      {/* Pantalla chica: el reporte se abre acá mismo, porque no
                          hay lugar para un carril al costado. */}
                      {hoy && reporteEn === col.clave && (
                        <div className="mb-3 lg:hidden">
                          <ReporteUrgencia
                            tareasColumna={items}
                            titulo={col.titulo}
                            color={col.color}
                            hoy={hoy}
                            pegajoso={false}
                          />
                        </div>
                      )}
                    </div>
                    <div className="min-h-[90px] space-y-2">
                      {items.length === 0 && (
                        <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
                          Soltá una tarjeta aquí
                        </p>
                      )}
                      {agrupar(items).map(([cat, delGrupo]) => {
                      const cg = colorCategoria(cat);
                      const clave = `${col.clave}:${cat}`;
                      const cerrado = q === "" && !abiertos.has(clave);
                      const urgentes = delGrupo.filter((t) => t.prioridad === "Urgente").length;
                      return (
                      <div key={clave} className="space-y-2">
                        {/* Barra plegable: soltar una tarjeta encima también la mueve
                            a esta columna (el drop sube al contenedor). */}
                        <button
                          onClick={() => alternarGrupo(clave)}
                          aria-expanded={!cerrado}
                          className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left transition hover:brightness-95"
                          style={{ backgroundColor: cg.fondo, border: `1px solid ${cg.borde}` }}
                        >
                          <span
                            className="text-[10px] transition-transform"
                            style={{ transform: cerrado ? "rotate(0deg)" : "rotate(90deg)", color: cg.punto }}
                          >
                            ▶
                          </span>
                          <span className="flex-1 text-xs font-bold" style={{ color: cg.texto }}>
                            {cat}
                          </span>
                          {urgentes > 0 && (
                            <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                              {urgentes} urg
                            </span>
                          )}
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                            style={{ backgroundColor: cg.punto }}
                          >
                            {delGrupo.length}
                          </span>
                        </button>

                        {!cerrado && delGrupo.map((t) => {
                        const c2 = colorCategoria(t.categoria);
                        return (
                          <article
                            key={t.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", String(t.id));
                              e.currentTarget.classList.add("arrastrando");
                            }}
                            onDragEnd={(e) => e.currentTarget.classList.remove("arrastrando")}
                            onClick={() => setTareaAbierta(t)}
                            className="sombra-3d-suave cursor-pointer rounded-2xl p-3.5"
                            style={{ backgroundColor: c2.fondo, border: `1px solid ${c2.borde}` }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-bold" style={{ color: c2.texto }}>
                                {t.empresa}
                              </p>
                              {t.prioridad === "Urgente" && (
                                <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                                  Urgente
                                </span>
                              )}
                              {t.prioridad === "A" && (
                                <span className="shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                                  Prioridad A
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-slate-600">{t.tema}</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                                style={{ backgroundColor: c2.punto }}
                              >
                                {t.categoria}
                              </span>
                              {t.involucrados && (
                                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200">
                                  👤 {t.involucrados}
                                </span>
                              )}
                              {t.fecha &&
                                (() => {
                                  // El chip de fecha avisa cuánto falta: rojo si
                                  // venció o es hoy, ámbar si cae en la semana.
                                  const f = hoy ? parsearFechaCorta(t.fecha, hoy) : null;
                                  const dias = f && hoy ? diasHasta(f, hoy) : null;
                                  const clase =
                                    dias !== null && dias <= 0
                                      ? "bg-red-50 text-red-700 ring-red-200"
                                      : dias !== null && dias <= 7
                                      ? "bg-amber-50 text-amber-700 ring-amber-200"
                                      : "bg-white text-slate-600 ring-slate-200";
                                  const cuando =
                                    dias === null
                                      ? ""
                                      : dias < 0
                                      ? " · venció"
                                      : dias === 0
                                      ? " · HOY"
                                      : dias === 1
                                      ? " · mañana"
                                      : dias <= 7
                                      ? ` · en ${dias}d`
                                      : "";
                                  return (
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${clase}`}>
                                      📅 {t.fecha}
                                      {cuando}
                                      {t.confirmada === "Si" ? " ✓" : t.confirmada === "No" ? " (sin confirmar)" : ""}
                                    </span>
                                  );
                                })()}
                              {t.comentarios.length > 0 && (
                                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[#3b5bfd] ring-1 ring-slate-200">
                                  💬 {t.comentarios.length}
                                </span>
                              )}
                              {t.adjuntos.length > 0 && (
                                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[#3b5bfd] ring-1 ring-slate-200">
                                  📎 {t.adjuntos.length}
                                </span>
                              )}
                            </div>
                          </article>
                        );
                        })}
                      </div>
                      );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Carril del reporte — sólo existe cuando hay algo que mostrar. */}
            {hoy && columnaDelReporte && (
              <div className="hidden w-[330px] shrink-0 lg:block">
                <ReporteUrgencia
                  tareasColumna={visibles.filter((t) => t.estado === columnaDelReporte.clave)}
                  titulo={columnaDelReporte.titulo}
                  color={columnaDelReporte.color}
                  hoy={hoy}
                />
              </div>
            )}
            </div>
        </>
      </section>

      <footer className="mt-10 pb-6 text-center text-xs text-slate-400/70">
        Jimmy&apos;s Planner · datos del archivo Agenda 17_07.xlsx · los cambios se guardan en la base y se ven igual desde cualquier dispositivo
      </footer>

      {tareaModal && <ModalTarea tarea={tareaModal} onCerrar={() => setTareaAbierta(null)} />}
      <AgenteIA />
    </main>
  );
}
