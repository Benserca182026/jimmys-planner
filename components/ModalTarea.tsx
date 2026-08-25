"use client";

// Detalle de tarea: cambiar estado, dejar comentarios y adjuntar archivos.
// Los adjuntos <1MB se guardan completos en el navegador (descargables);
// los más grandes solo como referencia (nombre/tamaño).

import { useState } from "react";
import { colorCategoria, type Estado } from "@/lib/datos";
import { usePlanner, type Prioridad, type Tarea } from "@/lib/estado";

const ESTADOS: { clave: Estado; etiqueta: string; color: string }[] = [
  { clave: "pendiente", etiqueta: "Pendiente", color: "#f0a13a" },
  { clave: "agendado", etiqueta: "Agendado", color: "#12b3a8" },
  { clave: "listo", etiqueta: "Listo", color: "#3b5bfd" },
];

const PRIORIDADES: { clave: Prioridad; etiqueta: string; color: string }[] = [
  { clave: "Urgente", etiqueta: "Urgente", color: "#dc2626" },
  { clave: "A", etiqueta: "Prioridad A", color: "#f59e0b" },
  { clave: null, etiqueta: "Normal", color: "#64748b" },
];

const LIMITE_DATAURL = 1024 * 1024; // 1MB

/**
 * Agendar en Google Calendar. Si la API está configurada crea el evento de
 * verdad; si no, devuelve el link prellenado y funciona igual. El título y la
 * descripción salen de la tarea: no se tipea nada dos veces.
 */
function AgendarEnGoogle({ tarea }: { tarea: Tarea }) {
  const { asignarFecha } = usePlanner();
  const [cuando, setCuando] = useState("");
  const [aviso30, setAviso30] = useState(30);
  const [estado, setEstado] = useState<"listo" | "yendo">("listo");
  const [aviso, setAviso] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  const agendar = async () => {
    if (!cuando) return;
    setEstado("yendo");
    setAviso(null);
    setLink(null);
    try {
      const res = await fetch("/api/google/evento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: `${tarea.empresa} — ${tarea.tema}`,
          descripcion:
            `Categoría: ${tarea.categoria}` +
            (tarea.involucrados ? `\nInvolucrados: ${tarea.involucrados}` : "") +
            (tarea.observaciones ? `\nObservaciones: ${tarea.observaciones}` : "") +
            `\n\nCreado desde Jimmy's Planner (tarea #${tarea.id}).`,
          inicio: cuando,
          minutos: 60,
          avisoMinutos: aviso30,
          avisoCorreoMinutos: 1440,
          idTarea: tarea.id,
          zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAviso(data?.mensaje ?? "No se pudo agendar.");
        return;
      }
      setLink(data.link ?? null);
      setAviso(data.mensaje ?? "Evento creado en el calendario.");
      // El tablero refleja la fecha del evento, en el formato dd/mm del Excel.
      const d = new Date(cuando);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      asignarFecha(tarea.id, `${dd}/${mm}`);
    } catch {
      setAviso("No se pudo contactar el servidor.");
    } finally {
      setEstado("listo");
    }
  };

  return (
    <div className="mt-5">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
        Agendar en Google Calendar
      </p>
      <div className="flex gap-2">
        <input
          type="datetime-local"
          value={cuando}
          onChange={(e) => setCuando(e.target.value)}
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#3b5bfd] focus:ring-2 focus:ring-[#3b5bfd]/20"
        />
        <button
          onClick={agendar}
          disabled={!cuando || estado === "yendo"}
          className="rounded-xl bg-[#3b5bfd] px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {estado === "yendo" ? "…" : "📅 Agendar"}
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <label className="text-[11px] text-slate-500">Avisarme</label>
        <select
          value={aviso30}
          onChange={(e) => setAviso30(Number(e.target.value))}
          className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] outline-none focus:border-[#3b5bfd]"
        >
          <option value={10}>10 min antes</option>
          <option value={30}>30 min antes</option>
          <option value={60}>1 hora antes</option>
          <option value={120}>2 horas antes</option>
        </select>
        <span className="text-[10px] text-slate-400">+ correo un día antes</span>
      </div>
      {aviso && <p className="mt-2 text-[11px] text-slate-500">{aviso}</p>}
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-[11px] font-semibold text-[#3b5bfd] underline"
        >
          Abrir el evento en Google Calendar →
        </a>
      )}
    </div>
  );
}

export function ModalTarea({
  tarea,
  onCerrar,
}: {
  tarea: Tarea;
  onCerrar: () => void;
}) {
  const { moverTarea, cambiarPrioridad, asignarFecha, agregarComentario, agregarAdjunto } =
    usePlanner();
  const [comentario, setComentario] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const col = colorCategoria(tarea.categoria);

  const enviarComentario = () => {
    if (comentario.trim() === "") return;
    agregarComentario(tarea.id, comentario.trim());
    setComentario("");
  };

  const adjuntar = async (archivo: File | undefined) => {
    if (!archivo) return;
    setAviso(null);
    if (archivo.size <= LIMITE_DATAURL) {
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(archivo);
      });
      agregarAdjunto(tarea.id, {
        nombre: archivo.name,
        tipo: archivo.type || "archivo",
        tamano: archivo.size,
        dataUrl,
      });
    } else {
      agregarAdjunto(tarea.id, {
        nombre: archivo.name,
        tipo: archivo.type || "archivo",
        tamano: archivo.size,
      });
      setAviso(
        "Archivo mayor a 1MB: se guardó la referencia (nombre y tamaño), no el contenido."
      );
    }
  };

  const fmtTamano = (b: number) =>
    b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onCerrar}
    >
      <div
        className="aparecer max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-[26px] bg-white p-6 sombra-3d"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Tarea ${tarea.empresa}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <span
              className="mb-2 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
              style={{ backgroundColor: col.punto }}
            >
              {tarea.categoria}
            </span>
            <h3 className="text-xl font-bold text-slate-900">{tarea.empresa}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{tarea.tema}</p>
          </div>
          <button
            onClick={onCerrar}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          {tarea.prioridad === "Urgente" && (
            <span className="rounded-full bg-red-600 px-2 py-0.5 font-bold uppercase text-white">Urgente</span>
          )}
          {tarea.prioridad === "A" && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 font-bold uppercase text-white">Prioridad A</span>
          )}
          {tarea.involucrados && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600">👤 {tarea.involucrados}</span>
          )}
          {tarea.fecha && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600">
              📅 {tarea.fecha}
              {tarea.confirmada === "Si" ? " ✓" : tarea.confirmada === "No" ? " (sin confirmar)" : ""}
            </span>
          )}
          {tarea.observaciones && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600">📝 {tarea.observaciones}</span>
          )}
        </div>

        {/* Cambiar estado */}
        <div className="mt-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Estado</p>
          <div className="flex gap-2">
            {ESTADOS.map((e) => (
              <button
                key={e.clave}
                onClick={() => moverTarea(tarea.id, e.clave)}
                className="flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition"
                style={
                  tarea.estado === e.clave
                    ? { backgroundColor: e.color, color: "#fff" }
                    : { backgroundColor: "#f1f5f9", color: "#475569" }
                }
              >
                {e.etiqueta}
              </button>
            ))}
          </div>
        </div>

        {/* Prioridad — editable, se guarda al instante */}
        <div className="mt-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Prioridad</p>
          <div className="flex gap-2">
            {PRIORIDADES.map((p) => {
              const activa = (tarea.prioridad ?? null) === p.clave;
              return (
                <button
                  key={p.etiqueta}
                  onClick={() => cambiarPrioridad(tarea.id, p.clave)}
                  className="flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition"
                  style={
                    activa
                      ? { backgroundColor: p.color, color: "#fff" }
                      : { backgroundColor: "#f1f5f9", color: "#475569" }
                  }
                >
                  {p.etiqueta}
                </button>
              );
            })}
          </div>
        </div>

        {/* Confirmación de la fecha — sólo la persona puede afirmarla, porque
            confirmar depende de la otra parte y el tablero no la conoce. */}
        {tarea.fecha && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              ¿La otra parte confirmó el {tarea.fecha}?
            </p>
            <div className="flex gap-2">
              {[
                { v: "Si" as const, txt: "Sí, confirmada", color: "#12b3a8" },
                { v: "No" as const, txt: "No, todavía", color: "#f0a13a" },
                { v: undefined, txt: "No se sabe", color: "#94a3b8" },
              ].map((o) => {
                const activa = tarea.confirmada === o.v;
                return (
                  <button
                    key={o.txt}
                    onClick={() => asignarFecha(tarea.id, tarea.fecha!, o.v)}
                    className="flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition"
                    style={
                      activa
                        ? { backgroundColor: o.color, color: "#fff" }
                        : { backgroundColor: "#f1f5f9", color: "#475569" }
                    }
                  >
                    {o.txt}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Agendar en Google Calendar */}
        <AgendarEnGoogle tarea={tarea} />

        {/* Comentarios */}
        <div className="mt-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
            Comentarios ({tarea.comentarios.length})
          </p>
          <div className="space-y-2">
            {tarea.comentarios.map((c) => (
              <div key={c.id} className="rounded-xl bg-slate-50 px-3.5 py-2.5">
                <p className="text-sm text-slate-700">{c.texto}</p>
                <p className="mt-1 text-[10px] text-slate-400">{c.fecha}</p>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enviarComentario()}
              placeholder="Escribí un comentario…"
              className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#3b5bfd] focus:ring-2 focus:ring-[#3b5bfd]/20"
            />
            <button
              onClick={enviarComentario}
              className="rounded-xl bg-[#3b5bfd] px-4 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Enviar
            </button>
          </div>
        </div>

        {/* Archivos */}
        <div className="mt-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
            Archivos ({tarea.adjuntos.length})
          </p>
          <div className="space-y-2">
            {tarea.adjuntos.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-700">📎 {a.nombre}</p>
                  <p className="text-[10px] text-slate-400">{fmtTamano(a.tamano)} · {a.fecha}</p>
                </div>
                {a.dataUrl && (
                  <a
                    href={a.dataUrl}
                    download={a.nombre}
                    className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#3b5bfd] ring-1 ring-slate-200 transition hover:bg-slate-100"
                  >
                    Descargar
                  </a>
                )}
              </div>
            ))}
          </div>
          <label className="mt-2 block cursor-pointer rounded-xl border-2 border-dashed border-slate-200 px-4 py-4 text-center text-sm text-slate-500 transition hover:border-[#3b5bfd]/50 hover:bg-slate-50">
            ⇪ Adjuntar archivo
            <input type="file" className="hidden" onChange={(e) => adjuntar(e.target.files?.[0])} />
          </label>
          {aviso && <p className="mt-2 text-xs text-amber-700">{aviso}</p>}
          <p className="mt-2 text-[10px] text-slate-400">
            Los comentarios y archivos se guardan en la base del planner y se ven desde cualquier dispositivo. Archivos: hasta 1MB viaja el contenido; más grandes, sólo nombre y tamaño.
          </p>
        </div>
      </div>
    </div>
  );
}
