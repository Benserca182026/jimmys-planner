"use client";

// Agente IA del planner — popup flotante con MENÚ DE CONVERSACIONES.
// · Varias conversaciones guardadas en el navegador: retomar, crear, borrar
// · Respuestas en varias burbujas cortas con emojis (separador '|||')
// · Siempre propone 3 respuestas sugeridas para continuar con un toque
// · Pendiente de conectar a Supabase en una fase futura (sincronizar equipos)
// · Con clave (OpenRouter/Anthropic) usa IA real; sin clave, análisis local.

import { useEffect, useRef, useState } from "react";
import { type Categoria } from "@/lib/datos";
import { usePlanner, type Tarea } from "@/lib/estado";
import { SKILLS, type ResultadoSkill } from "@/lib/skills";

interface Mensaje {
  rol: "usuario" | "agente";
  texto: string;
}

interface Conversacion {
  id: string;
  titulo: string;
  fecha: string;
  mensajes: Mensaje[];
  sugerencias: string[];
}

const CLAVE_API_LS = "jp_api_key";
const CLAVE_CHATS_LS = "jp_chats_v2";
const CLAVE_CHAT_VIEJA = "jp_chat_v1";
const MAX_MENSAJES = 60;
const MAX_CONVERSACIONES = 20;

const SALUDO: Mensaje = {
  rol: "agente",
  texto:
    "👋 Hola, soy el **agente del planner**.\nPuedo analizar tus tareas por categoría, urgencias o contenido — tocá una sugerencia o escribime.",
};
const SUGERENCIAS_INICIALES = ["Resumen general", "¿Qué es urgente?", "Analizar Comercial"];

function nuevaConversacion(): Conversacion {
  return {
    id: `conv-${Date.now()}`,
    titulo: "Nueva conversación",
    fecha: new Date().toLocaleDateString("es", { day: "2-digit", month: "short" }),
    mensajes: [SALUDO],
    sugerencias: SUGERENCIAS_INICIALES,
  };
}

function TextoRico({ texto }: { texto: string }) {
  const partes = texto.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {partes.map((p, i) =>
        i % 2 === 1 ? (
          <b key={i} className="font-bold">
            {p}
          </b>
        ) : (
          p
        )
      )}
    </>
  );
}

// ── Análisis local (sin API) — burbujas + sugerencias ──
function analisisLocal(
  pregunta: string,
  tareas: Tarea[]
): { bloques: string[]; sugerencias: string[] } {
  const q = pregunta.toLowerCase();
  const categorias = [...new Set(tareas.map((t) => t.categoria))] as Categoria[];
  const conteo = (estado: string) => tareas.filter((t) => t.estado === estado).length;

  const catPedida = categorias.find((c) => q.includes(c.toLowerCase()));
  if (catPedida) {
    const items = tareas.filter((t) => t.categoria === catPedida);
    return {
      bloques: [
        `📊 **${catPedida}**: ${items.length} tareas\n⏳ ${items.filter((t) => t.estado === "pendiente").length} pendientes · 📅 ${items.filter((t) => t.estado === "agendado").length} agendadas · ✅ ${items.filter((t) => t.estado === "listo").length} listas`,
        `🗂️ Temas:\n${items.slice(0, 10).map((t) => `• **${t.empresa}** — ${t.tema}`).join("\n")}${items.length > 10 ? `\n…y ${items.length - 10} más` : ""}`,
      ],
      sugerencias: ["¿Qué es urgente?", "Resumen general", `¿Qué agendo primero de ${catPedida}?`],
    };
  }

  if (q.includes("urgente") || q.includes("prioridad")) {
    const urgentes = tareas.filter((t) => t.prioridad);
    return {
      bloques:
        urgentes.length === 0
          ? ["✅ No hay tareas marcadas con prioridad."]
          : [
              `🔴 **${urgentes.length} tarea(s) con prioridad:**`,
              urgentes.map((t) => `• **[${t.prioridad}]** ${t.empresa} — ${t.tema} (${t.estado})`).join("\n"),
            ],
      sugerencias: ["Resumen general", "Analizar Comercial", "Analizar Regional"],
    };
  }

  if (q.includes("resumen") || q.includes("general") || q.includes("todo")) {
    const masCargada = [...categorias].sort(
      (a, b) =>
        tareas.filter((t) => t.categoria === b).length -
        tareas.filter((t) => t.categoria === a).length
    )[0];
    return {
      bloques: [
        `📋 **Resumen**: ${tareas.length} tareas en total\n⏳ **${conteo("pendiente")}** pendientes · 📅 **${conteo("agendado")}** agendadas · ✅ **${conteo("listo")}** listas`,
        `🗂️ Por categoría:\n${categorias.map((c) => `• ${c}: **${tareas.filter((t) => t.categoria === c).length}**`).join("\n")}`,
        `💡 La categoría con más carga es **${masCargada}**.`,
      ],
      sugerencias: [`Analizar ${masCargada}`, "¿Qué es urgente?", "¿Qué agendo esta semana?"],
    };
  }

  const encontradas = tareas.filter(
    (t) => t.empresa.toLowerCase().includes(q) || t.tema.toLowerCase().includes(q)
  );
  if (encontradas.length > 0) {
    return {
      bloques: [
        `🔎 Encontré **${encontradas.length}** tarea(s):`,
        encontradas.slice(0, 10).map((t) => `• **[${t.categoria} · ${t.estado}]** ${t.empresa} — ${t.tema}`).join("\n"),
      ],
      sugerencias: ["Resumen general", "¿Qué es urgente?", "Analizar Comercial"],
    };
  }

  return {
    bloques: [
      "🤔 En modo local puedo:\n• **resumen general**\n• **urgentes**\n• una **categoría** (ej. Comercial)\n• una **empresa** (ej. Coppel)",
      "💡 Pegá tu clave de API en ⚙️ para análisis avanzado con IA.",
    ],
    sugerencias: SUGERENCIAS_INICIALES,
  };
}

function parsearRespuestaIA(cruda: string): { bloques: string[]; sugerencias: string[] } {
  let cuerpo = cruda;
  let sugerencias: string[] = [];
  const m = cruda.match(/SUGERENCIAS:\s*(.+)\s*$/im);
  if (m) {
    sugerencias = m[1].split("|").map((s) => s.trim()).filter(Boolean).slice(0, 3);
    cuerpo = cruda.replace(/SUGERENCIAS:.*$/im, "").trim();
  }
  const bloques = cuerpo
    .split(/\n?\s*\|\|\|\s*\n?/)
    .map((b) => b.trim())
    .filter(Boolean);
  return {
    bloques: bloques.length > 0 ? bloques : [cuerpo],
    sugerencias: sugerencias.length > 0 ? sugerencias : SUGERENCIAS_INICIALES,
  };
}

export function AgenteIA() {
  const { tareas } = usePlanner();
  const [abierto, setAbierto] = useState(false);
  const [vistaMenu, setVistaMenu] = useState(false);
  const [seccionMenu, setSeccionMenu] = useState<"conversaciones" | "skills">("conversaciones");
  const [skillActiva, setSkillActiva] = useState<string | null>(null);
  const [config, setConfig] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [entrada, setEntrada] = useState("");
  const [pensando, setPensando] = useState(false);
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([nuevaConversacion()]);
  const [activaId, setActivaId] = useState<string>("");
  const finRef = useRef<HTMLDivElement>(null);

  const activa =
    conversaciones.find((c) => c.id === activaId) ?? conversaciones[0];

  // Cargar clave + conversaciones (migra el formato viejo de un solo chat).
  useEffect(() => {
    try {
      const k = window.localStorage.getItem(CLAVE_API_LS);
      if (k) setApiKey(k);

      const crudo = window.localStorage.getItem(CLAVE_CHATS_LS);
      if (crudo) {
        const { conversaciones: cs, activaId: aid } = JSON.parse(crudo);
        if (Array.isArray(cs) && cs.length > 0) {
          setConversaciones(cs);
          setActivaId(aid && cs.some((c: Conversacion) => c.id === aid) ? aid : cs[0].id);
          return;
        }
      }
      // Migración desde el formato anterior (una sola conversación)
      const viejo = window.localStorage.getItem(CLAVE_CHAT_VIEJA);
      if (viejo) {
        const { mensajes, sugerencias } = JSON.parse(viejo);
        if (Array.isArray(mensajes) && mensajes.length > 1) {
          const primera = mensajes.find((m: Mensaje) => m.rol === "usuario");
          const migrada: Conversacion = {
            ...nuevaConversacion(),
            titulo: primera ? primera.texto.slice(0, 40) : "Conversación anterior",
            mensajes,
            sugerencias: sugerencias?.length ? sugerencias : SUGERENCIAS_INICIALES,
          };
          setConversaciones([migrada]);
          setActivaId(migrada.id);
          window.localStorage.removeItem(CLAVE_CHAT_VIEJA);
        }
      }
    } catch {}
  }, []);

  // Guardar todo (memoria del navegador — luego se conectará a Supabase).
  useEffect(() => {
    try {
      window.localStorage.setItem(
        CLAVE_CHATS_LS,
        JSON.stringify({
          activaId: activa?.id,
          conversaciones: conversaciones.slice(0, MAX_CONVERSACIONES).map((c) => ({
            ...c,
            mensajes: c.mensajes.slice(-MAX_MENSAJES),
          })),
        })
      );
    } catch {}
  }, [conversaciones, activa?.id]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activa?.mensajes, abierto, pensando, vistaMenu]);

  const guardarClave = (k: string) => {
    setApiKey(k);
    try {
      if (k) window.localStorage.setItem(CLAVE_API_LS, k);
      else window.localStorage.removeItem(CLAVE_API_LS);
    } catch {}
  };

  const actualizarActiva = (fn: (c: Conversacion) => Conversacion) => {
    setConversaciones((prev) => prev.map((c) => (c.id === activa.id ? fn(c) : c)));
  };

  const crearConversacion = () => {
    const nueva = nuevaConversacion();
    setConversaciones((prev) => [nueva, ...prev].slice(0, MAX_CONVERSACIONES));
    setActivaId(nueva.id);
    setVistaMenu(false);
  };

  const borrarConversacion = (id: string) => {
    setConversaciones((prev) => {
      const quedan = prev.filter((c) => c.id !== id);
      const resultado = quedan.length > 0 ? quedan : [nuevaConversacion()];
      if (id === activaId) setActivaId(resultado[0].id);
      return resultado;
    });
  };

  const preguntar = async (texto: string) => {
    if (texto.trim() === "" || pensando) return;
    // Primer mensaje del usuario → título de la conversación
    actualizarActiva((c) => ({
      ...c,
      titulo: c.titulo === "Nueva conversación" ? texto.slice(0, 40) : c.titulo,
      mensajes: [...c.mensajes, { rol: "usuario", texto }],
    }));
    setEntrada("");
    setPensando(true);

    let resultado: { bloques: string[]; sugerencias: string[] };
    if (apiKey) {
      try {
        const res = await fetch("/api/analizar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pregunta: texto,
            tareas,
            apiKey,
            // Hilo previo (sin el saludo) para que la respuesta y las
            // sugerencias continúen la conversación.
            historial: activa.mensajes.slice(1).slice(-10),
          }),
        });
        const data = await res.json();
        if (res.ok) {
          resultado = parsearRespuestaIA(data.respuesta);
          // Blindaje final: si por cualquier motivo no quedó texto visible,
          // respondemos con el análisis local en vez de una burbuja vacía.
          if (resultado.bloques.every((b) => b.trim() === "")) {
            const local = analisisLocal(texto, tareas);
            resultado = {
              bloques: ["⚠️ La IA devolvió una respuesta vacía — análisis local:", ...local.bloques],
              sugerencias: local.sugerencias,
            };
          }
        } else {
          const local = analisisLocal(texto, tareas);
          resultado = {
            bloques: [`⚠️ ${data.mensaje ?? "Error con la API"} — modo local:`, ...local.bloques],
            sugerencias: local.sugerencias,
          };
        }
      } catch {
        const local = analisisLocal(texto, tareas);
        resultado = {
          bloques: ["⚠️ Sin conexión con la API — modo local:", ...local.bloques],
          sugerencias: local.sugerencias,
        };
      }
    } else {
      resultado = analisisLocal(texto, tareas);
    }

    for (let i = 0; i < resultado.bloques.length; i++) {
      const bloque = resultado.bloques[i];
      actualizarActiva((c) => ({
        ...c,
        mensajes: [...c.mensajes, { rol: "agente", texto: bloque }],
      }));
      if (i < resultado.bloques.length - 1) {
        await new Promise((r) => setTimeout(r, 350));
      }
    }
    actualizarActiva((c) => ({ ...c, sugerencias: resultado.sugerencias }));
    setPensando(false);
  };

  return (
    <>
      <button
        onClick={() => setAbierto(!abierto)}
        className="pulso-azul fixed bottom-6 right-6 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#3b5bfd] text-2xl text-white transition hover:scale-105"
        aria-label="Abrir agente IA"
      >
        {abierto ? "✕" : "🤖"}
      </button>

      {abierto && (
        <div
          className={`aparecer fixed bottom-24 right-6 z-40 flex h-[560px] flex-col overflow-hidden rounded-[24px] bg-white sombra-3d transition-all ${
            vistaMenu ? "w-[min(620px,calc(100vw-3rem))]" : "w-[min(390px,calc(100vw-3rem))]"
          }`}
        >
          {/* Encabezado */}
          <div className="flex items-center justify-between bg-[#0a0f2e] px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/10 text-base">🤖</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">
                  {vistaMenu ? "Menú del agente" : activa.titulo === "Nueva conversación" ? "Agente del planner" : activa.titulo}
                </p>
                <p className="text-[10px] text-slate-300/80">
                  {apiKey ? "IA conectada ✓" : "Modo local · sin API"} · memoria en este navegador
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                onClick={() => setVistaMenu(!vistaMenu)}
                className={`grid h-8 w-8 place-items-center rounded-lg text-sm text-white transition hover:bg-white/20 ${vistaMenu ? "bg-white/25" : "bg-white/10"}`}
                aria-label="Menú de conversaciones"
                title="Conversaciones"
              >
                ☰
              </button>
              <button
                onClick={() => setConfig(!config)}
                className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-sm text-white transition hover:bg-white/20"
                aria-label="Configuración"
              >
                ⚙️
              </button>
            </div>
          </div>

          {config && (
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
              <p className="mb-1.5 text-xs font-semibold text-slate-600">
                Clave de API (OpenRouter o Anthropic) — se guarda solo en este navegador
              </p>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => guardarClave(e.target.value)}
                placeholder="sk-or-… (OpenRouter) o sk-ant-… (Anthropic)"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#3b5bfd]"
              />
            </div>
          )}

          {vistaMenu ? (
            /* ── MENÚ EXPANDIDO: Conversaciones | Skills ── */
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Pestañas horizontales */}
              <div className="flex gap-2 border-b border-slate-100 p-3">
                <button
                  onClick={() => {
                    setSeccionMenu("conversaciones");
                    setSkillActiva(null);
                  }}
                  className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                    seccionMenu === "conversaciones"
                      ? "bg-[#3b5bfd] text-white shadow"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  💬 Conversaciones
                </button>
                <button
                  onClick={() => setSeccionMenu("skills")}
                  className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                    seccionMenu === "skills"
                      ? "bg-[#3b5bfd] text-white shadow"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  🧩 Skills
                </button>
              </div>

              {seccionMenu === "conversaciones" ? (
                <>
                  <div className="p-3">
                    <button
                      onClick={crearConversacion}
                      className="w-full rounded-xl bg-[#3b5bfd] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                    >
                      ➕ Nueva conversación
                    </button>
                  </div>
                  <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-3">
                    {conversaciones.map((c) => (
                      <div
                        key={c.id}
                        className={`flex items-center gap-2 rounded-xl border p-3 transition ${
                          c.id === activa.id
                            ? "border-[#3b5bfd]/40 bg-[#e8edff]"
                            : "border-slate-150 bg-slate-50 hover:bg-slate-100"
                        }`}
                      >
                        <button
                          onClick={() => {
                            setActivaId(c.id);
                            setVistaMenu(false);
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate text-sm font-semibold text-slate-800">
                            💬 {c.titulo}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {c.fecha} · {c.mensajes.filter((m) => m.rol === "usuario").length} preguntas
                          </p>
                        </button>
                        <button
                          onClick={() => borrarConversacion(c.id)}
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          aria-label={`Borrar ${c.titulo}`}
                          title="Borrar"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="border-t border-slate-100 px-4 py-2 text-center text-[10px] text-slate-400">
                    Guardadas en este navegador · próximamente sincronizadas con Supabase
                  </p>
                </>
              ) : skillActiva ? (
                /* Resultado de una skill (cálculo en código, sin IA) */
                (() => {
                  const skill = SKILLS.find((s) => s.id === skillActiva)!;
                  const r: ResultadoSkill = skill.ejecutar(tareas);
                  return (
                    <div className="flex-1 overflow-y-auto p-4">
                      <button
                        onClick={() => setSkillActiva(null)}
                        className="mb-3 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
                      >
                        ← Skills
                      </button>
                      <p className="text-base font-bold text-slate-900">
                        {skill.icono} {skill.nombre}
                      </p>
                      <p className="mt-1 rounded-xl bg-[#e8edff] px-3.5 py-2.5 text-xs font-medium leading-relaxed text-[#2540c0]">
                        {r.resumen}
                      </p>
                      {r.secciones.map((sec, i) => (
                        <div key={i} className="mt-4">
                          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                            {sec.titulo}
                          </p>
                          {sec.tipo === "kpis" && (
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                              {sec.kpis?.map((k) => (
                                <div key={k.etiqueta} className="rounded-xl bg-slate-50 p-3 text-center">
                                  <p className="text-lg font-bold tabular-nums" style={{ color: k.color }}>
                                    {k.valor}
                                  </p>
                                  <p className="mt-0.5 text-[10px] leading-tight text-slate-500">{k.etiqueta}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          {sec.tipo === "barras" && (
                            <div className="space-y-2">
                              {sec.barras?.map((b) => (
                                <div key={b.etiqueta}>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold text-slate-700">{b.etiqueta}</span>
                                    <span className="tabular-nums text-slate-500">{b.valor}</span>
                                  </div>
                                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
                                    <div
                                      className="h-full rounded-full"
                                      style={{ width: `${b.pct}%`, backgroundColor: b.color }}
                                    />
                                  </div>
                                  {b.detalle && (
                                    <p className="mt-0.5 truncate text-[10px] text-slate-400">{b.detalle}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {sec.tipo === "ranking" && (
                            <div className="space-y-1.5">
                              {sec.filas?.map((f) => (
                                <div
                                  key={`${f.posicion}-${f.titulo}`}
                                  className={`flex items-center gap-3 rounded-xl p-2.5 ${
                                    f.destacada ? "bg-[#e8edff] ring-1 ring-[#3b5bfd]/30" : "bg-slate-50"
                                  }`}
                                >
                                  <span
                                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                                    style={{ backgroundColor: f.color ?? "#94a3b8" }}
                                  >
                                    {f.posicion}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-bold text-slate-800">{f.titulo}</p>
                                    {f.subtitulo && (
                                      <p className="truncate text-[10px] text-slate-500">{f.subtitulo}</p>
                                    )}
                                  </div>
                                  <span className="shrink-0 text-xs font-bold tabular-nums" style={{ color: f.color }}>
                                    {f.valor}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          {sec.nota && (
                            <p className="mt-2 text-[10px] leading-relaxed text-slate-400">{sec.nota}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()
              ) : (
                /* Catálogo de skills */
                <div className="flex-1 overflow-y-auto p-4">
                  <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
                    Herramientas de análisis <b>100% programadas</b> — instantáneas, exactas y sin
                    consumir IA. Se calculan sobre el estado actual del tablero.
                  </p>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {SKILLS.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSkillActiva(s.id)}
                        className="sombra-3d-suave rounded-2xl border border-slate-100 bg-white p-4 text-left transition"
                      >
                        <p className="text-2xl">{s.icono}</p>
                        <p className="mt-1.5 text-sm font-bold text-slate-800">{s.nombre}</p>
                        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{s.descripcion}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── CHAT ── */
            <>
              <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
                {activa.mensajes.map((m, i) => (
                  <div
                    key={i}
                    className={`aparecer max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      m.rol === "usuario"
                        ? "ml-auto bg-[#3b5bfd] text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    <TextoRico texto={m.texto} />
                  </div>
                ))}
                {pensando && (
                  <div className="w-fit rounded-2xl bg-slate-100 px-3.5 py-2.5 text-xs text-slate-400">
                    Analizando…
                  </div>
                )}

                {/* El agente propone cómo seguir — burbuja propia al final de su conclusión */}
                {!pensando && activa.sugerencias.length > 0 && (
                  <div className="aparecer max-w-[85%] rounded-2xl bg-[#e8edff] px-3.5 py-3">
                    <p className="mb-2 text-[11px] font-semibold text-[#3b5bfd]">
                      💬 ¿Cómo seguimos?
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {activa.sugerencias.map((s) => (
                        <button
                          key={s}
                          onClick={() => preguntar(s)}
                          className="rounded-xl border border-[#3b5bfd]/25 bg-white px-3 py-2 text-left text-[11px] font-semibold text-[#3b5bfd] transition hover:bg-[#3b5bfd] hover:text-white"
                        >
                          ➡️ {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div ref={finRef} />
              </div>

              <div className="border-t border-slate-100 p-3">
                <div className="flex gap-2">
                  <input
                    value={entrada}
                    onChange={(e) => setEntrada(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && preguntar(entrada)}
                    placeholder="Preguntame sobre tus tareas…"
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#3b5bfd] focus:ring-2 focus:ring-[#3b5bfd]/20"
                  />
                  <button
                    onClick={() => preguntar(entrada)}
                    disabled={pensando}
                    className="rounded-xl bg-[#3b5bfd] px-3.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    ➤
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
