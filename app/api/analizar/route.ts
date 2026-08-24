import { NextResponse } from "next/server";

// Análisis con IA de las tareas del planner.
//
// ARQUITECTURA: la app ejecuta "habilidades de análisis" EN CÓDIGO (conteos,
// rankings, cargas, urgencias — todo calculado acá) y le entrega el resultado
// ya cocinado al modelo. La IA interpreta, prioriza y redacta — tiene
// PROHIBIDO calcular o contar por su cuenta.
//
// Acepta claves de OpenRouter (sk-or-…) o Anthropic (sk-ant-…), o variables de
// entorno OPENROUTER_API_KEY / ANTHROPIC_API_KEY en Vercel.

const MODELO_ANTHROPIC = "claude-haiku-4-5-20251001";
const MODELO_OPENROUTER = "deepseek/deepseek-v4-flash-0731";

const SISTEMA =
  "Eres el asistente de análisis de Jimmy's Planner, un tablero de agenda comercial. " +
  "Respondes SIEMPRE en español, de forma breve, concreta y accionable.\n\n" +
  "HABILIDADES DE ANÁLISIS: el sistema ya ejecutó las herramientas de análisis en código y te " +
  "entrega sus resultados en el bloque ANÁLISIS CALCULADO (totales, cargas por categoría con " +
  "porcentajes, ranking de empresas, urgencias, agendadas con fecha, actividad). Tu trabajo es " +
  "INTERPRETAR esos resultados y responder la pregunta: priorizar, recomendar, explicar, detectar " +
  "riesgos. Tienes PROHIBIDO calcular, contar o estimar números por tu cuenta — todo número que " +
  "menciones debe salir literal del bloque ANÁLISIS CALCULADO o de la lista de tareas. Si la " +
  "pregunta exige un cálculo que no está en el bloque, decilo con transparencia y ofrecé el " +
  "análisis más cercano que sí tengas.\n\n" +
  "FORMATO OBLIGATORIO de cada respuesta:\n" +
  "1. Divide la respuesta en 2 o 3 bloques CORTOS separados por una línea que contenga solo '|||' " +
  "(cada bloque es una burbuja de chat). Nunca un solo bloque largo.\n" +
  "2. Usa emojis (📊 ✅ ⏳ 📅 🔴 💡 👤 ➡️ 🏆 ⚠️) y **negritas** para nombres y números clave. " +
  "Viñetas cortas, no párrafos largos.\n" +
  "3. Termina SIEMPRE con una última línea EXACTA (sin emojis en ella):\n" +
  "SUGERENCIAS: opción uno | opción dos | opción tres\n" +
  "— tres preguntas cortas (máx 6 palabras), variadas y accionables (una de priorización, una de " +
  "análisis por categoría/empresa, una de detalle), que sigan naturalmente la conversación.";

// SEGUNDA CAPA — "buscar lo que la regla no ve".
// No juzga prioridades ni recalcula nada: el ranking lo hace el código. Su único
// oficio es rastrear datos sepultados en el TEXTO libre de las tareas (que el
// score no puede leer) y traerlos a la forma para que la regla vuelva a juzgar.
// Cita textual obligatoria: sin ella el hallazgo no es verificable y se descarta.
const SISTEMA_HALLAZGOS =
  "Sos un detector de datos sepultados en texto libre, para un tablero de agenda comercial. " +
  "Respondés SIEMPRE en español.\n\n" +
  "TENÉS PROHIBIDO: opinar sobre prioridades, rankear, puntuar, contar, estimar, recomendar qué " +
  "hacer primero. Eso ya lo resolvió el sistema con reglas programadas y no es asunto tuyo.\n\n" +
  "TU ÚNICO OFICIO: leer el TEXTO de cada tarea y encontrar información que está escrita ahí pero " +
  "NO está cargada en los campos estructurados. Buscá:\n" +
  "- fecha: una fecha o plazo mencionado en el texto de una tarea que no tiene fecha cargada\n" +
  "- dependencia: dos tareas que son en realidad la misma gestión partida en renglones\n" +
  "- persona: alguien nombrado en el texto que no está en el campo de involucrados\n" +
  "- compromiso: algo prometido a un tercero que fija un plazo implícito\n\n" +
  "REGLA ABSOLUTA: cada hallazgo debe incluir la cita TEXTUAL Y LITERAL del fragmento de donde lo " +
  "sacaste, copiada carácter por carácter de la tarea. Si no podés citar, no lo reportes. Nunca " +
  "infieras algo que no esté escrito.\n\n" +
  "Respondé ÚNICAMENTE con un array JSON válido, sin markdown, sin explicaciones alrededor:\n" +
  '[{"tipo":"fecha|dependencia|persona|compromiso","empresa":"...","cita":"fragmento literal",' +
  '"hallazgo":"qué encontraste, en una línea","propuesta":"qué campo llenar o qué hacer, en una línea"}]\n' +
  "Máximo 8 hallazgos, los más concretos. Si no encontrás nada verificable, devolvé [].";

type TareaEntrada = {
  empresa: string;
  tema: string;
  categoria: string;
  estado: string;
  prioridad?: string;
  fecha?: string;
  confirmada?: string;
  involucrados?: string;
  comentarios?: { texto: string }[];
  adjuntos?: { nombre: string }[];
};

// ── HABILIDAD DE ANÁLISIS (ejecutada en código, no por la IA) ──
function ejecutarAnalisis(lista: TareaEntrada[]): string {
  const total = lista.length;
  const porEstado = new Map<string, number>();
  const porCategoria = new Map<string, number>();
  const porEmpresa = new Map<string, number>();
  const urgentes: string[] = [];
  const agendadasConFecha: string[] = [];
  const conComentarios: string[] = [];
  const conAdjuntos: string[] = [];

  for (const t of lista) {
    porEstado.set(t.estado, (porEstado.get(t.estado) ?? 0) + 1);
    porCategoria.set(t.categoria, (porCategoria.get(t.categoria) ?? 0) + 1);
    porEmpresa.set(t.empresa, (porEmpresa.get(t.empresa) ?? 0) + 1);
    if (t.prioridad) urgentes.push(`${t.empresa} — ${t.tema} [${t.prioridad}] (${t.estado})`);
    if (t.fecha)
      agendadasConFecha.push(
        `${t.empresa} — ${t.tema} (fecha ${t.fecha}${t.confirmada ? `, confirmada: ${t.confirmada}` : ""})`
      );
    if (t.comentarios && t.comentarios.length > 0)
      conComentarios.push(`${t.empresa} (${t.comentarios.length} comentarios)`);
    if (t.adjuntos && t.adjuntos.length > 0)
      conAdjuntos.push(`${t.empresa} (${t.adjuntos.length} archivos)`);
  }

  const pct = (n: number) => `${Math.round((n / Math.max(total, 1)) * 100)}%`;
  const categoriasOrdenadas = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]);
  const topEmpresas = [...porEmpresa.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return [
    `TOTAL DE TAREAS: ${total}`,
    `POR ESTADO: ${[...porEstado.entries()].map(([k, v]) => `${k}=${v} (${pct(v)})`).join(", ")}`,
    `CARGA POR CATEGORÍA (mayor a menor): ${categoriasOrdenadas.map(([k, v]) => `${k}=${v} (${pct(v)})`).join(", ")}`,
    `CATEGORÍA MÁS CARGADA: ${categoriasOrdenadas[0]?.[0] ?? "n/a"} con ${categoriasOrdenadas[0]?.[1] ?? 0} tareas`,
    `TOP 5 EMPRESAS POR VOLUMEN: ${topEmpresas.map(([k, v]) => `${k}=${v}`).join(", ")}`,
    `TAREAS CON PRIORIDAD MARCADA (${urgentes.length}): ${urgentes.length ? urgentes.join(" · ") : "ninguna"}`,
    `TAREAS CON FECHA PROGRAMADA (${agendadasConFecha.length}): ${agendadasConFecha.length ? agendadasConFecha.join(" · ") : "ninguna"}`,
    `TAREAS CON ACTIVIDAD — comentarios: ${conComentarios.length ? conComentarios.join(", ") : "ninguna"} | archivos: ${conAdjuntos.length ? conAdjuntos.join(", ") : "ninguna"}`,
  ].join("\n");
}

// Extrae texto de las distintas formas en que puede venir la respuesta
// (los modelos razonadores a veces devuelven `content` vacío y el texto en
// `reasoning` — causa de los "mensajes vacíos").
function extraerTextoOpenRouter(data: unknown): string {
  const d = data as {
    choices?: { message?: { content?: unknown; reasoning?: string } }[];
  };
  const msg = d?.choices?.[0]?.message;
  if (!msg) return "";
  if (typeof msg.content === "string" && msg.content.trim()) return msg.content;
  if (Array.isArray(msg.content)) {
    const partes = (msg.content as { type?: string; text?: string }[])
      .map((p) => p?.text ?? "")
      .join("");
    if (partes.trim()) return partes;
  }
  if (typeof msg.reasoning === "string" && msg.reasoning.trim()) return msg.reasoning;
  return "";
}

function extraerTextoAnthropic(data: unknown): string {
  const d = data as { content?: { type: string; text?: string }[] };
  return d?.content?.find((b) => b.type === "text")?.text ?? "";
}

async function llamarModelo(
  clave: string,
  esOR: boolean,
  mensajeUsuario: string,
  sistema: string = SISTEMA
): Promise<{ ok: boolean; texto?: string; status?: number; detalle?: string }> {
  const res = esOR
    ? await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${clave}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODELO_OPENROUTER,
          max_tokens: 1400,
          temperature: 0.4,
          messages: [
            { role: "system", content: sistema },
            { role: "user", content: mensajeUsuario },
          ],
        }),
      })
    : await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": clave,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODELO_ANTHROPIC,
          max_tokens: 1400,
          system: sistema,
          messages: [{ role: "user", content: mensajeUsuario }],
        }),
      });

  if (!res.ok) {
    const detalle = await res.text();
    return { ok: false, status: res.status, detalle: detalle.slice(0, 300) };
  }
  const data = await res.json();
  const texto = esOR ? extraerTextoOpenRouter(data) : extraerTextoAnthropic(data);
  return { ok: true, texto };
}

/** Rescata el array JSON aunque el modelo lo envuelva en ``` o en texto. */
function extraerArrayJSON(texto: string): unknown[] | null {
  const limpio = texto.replace(/```json/gi, "").replace(/```/g, "").trim();
  const desde = limpio.indexOf("[");
  const hasta = limpio.lastIndexOf("]");
  if (desde === -1 || hasta === -1 || hasta < desde) return null;
  try {
    const v = JSON.parse(limpio.slice(desde, hasta + 1));
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const { pregunta, tareas, apiKey, historial, modo } = await req.json().catch(() => ({}));
  const clave =
    apiKey || process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY;

  if (!clave) {
    return NextResponse.json(
      { error: "sin_clave", mensaje: "No hay clave de API configurada." },
      { status: 400 }
    );
  }
  const esHallazgos = modo === "hallazgos";

  if ((!pregunta && !esHallazgos) || !Array.isArray(tareas)) {
    return NextResponse.json(
      { error: "solicitud_invalida", mensaje: "Falta la pregunta o las tareas." },
      { status: 400 }
    );
  }

  const lista = tareas as TareaEntrada[];
  const esOR = clave.startsWith("sk-or");

  // ── SEGUNDA CAPA: sólo rastrea texto, no toca el ranking de la regla ──
  if (esHallazgos) {
    const sinFecha = lista.filter((t) => !t.fecha && t.estado !== "listo");
    const mensaje =
      "TAREAS SIN FECHA CARGADA (el ranking por reglas las puntúa en cero justamente por eso; " +
      "buscá en su TEXTO datos que no estén en los campos):\n" +
      sinFecha
        .map(
          (t) =>
            `- [${t.categoria}] ${t.empresa}: "${t.tema}"` +
            (t.involucrados ? ` (involucrados cargados: ${t.involucrados})` : " (sin involucrados cargados)")
        )
        .join("\n") +
      "\n\nDevolvé el array JSON de hallazgos.";

    try {
      const r = await llamarModelo(clave, esOR, mensaje, SISTEMA_HALLAZGOS);
      if (!r.ok) {
        return NextResponse.json(
          { error: "api_error", mensaje: `La API respondió ${r.status}.`, detalle: r.detalle },
          { status: 502 }
        );
      }
      const arr = extraerArrayJSON(r.texto ?? "");
      if (!arr) {
        return NextResponse.json(
          { error: "formato", mensaje: "El modelo no devolvió un JSON legible.", crudo: (r.texto ?? "").slice(0, 300) },
          { status: 502 }
        );
      }
      return NextResponse.json({ hallazgos: arr, evaluadas: sinFecha.length });
    } catch {
      return NextResponse.json({ error: "red", mensaje: "No se pudo contactar la API." }, { status: 502 });
    }
  }

  const analisis = ejecutarAnalisis(lista);
  const contexto = lista
    .map(
      (t) =>
        `- [${t.categoria} · ${t.estado}${t.prioridad ? " · " + t.prioridad : ""}] ${t.empresa}: ${t.tema}` +
        (t.involucrados ? ` (involucrados: ${t.involucrados})` : "") +
        (t.comentarios && t.comentarios.length > 0
          ? ` (comentarios: ${t.comentarios.map((c) => c.texto).join(" / ")})`
          : "")
    )
    .join("\n");

  // Historial de la conversación (últimos intercambios) para que la respuesta
  // y las 3 sugerencias continúen el hilo, no arranquen de cero cada vez.
  type MensajeHistorial = { rol: string; texto: string };
  const hist = Array.isArray(historial)
    ? (historial as MensajeHistorial[])
        .slice(-10)
        .map((m) => `${m.rol === "usuario" ? "USUARIO" : "AGENTE"}: ${m.texto}`)
        .join("\n")
    : "";

  const mensajeUsuario =
    `ANÁLISIS CALCULADO (por el sistema — usar estos números tal cual, no recalcular):\n${analisis}\n\n` +
    `LISTA DE TAREAS (para citar contenidos, no para contar):\n${contexto}\n\n` +
    (hist ? `CONVERSACIÓN PREVIA (continuar este hilo; las SUGERENCIAS deben seguir esta conversación):\n${hist}\n\n` : "") +
    `PREGUNTA ACTUAL: ${pregunta}`;

  try {
    // Primer intento + un reintento si el modelo devuelve texto vacío.
    let r = await llamarModelo(clave, esOR, mensajeUsuario);
    if (r.ok && (!r.texto || r.texto.trim() === "")) {
      r = await llamarModelo(clave, esOR, mensajeUsuario);
    }

    if (!r.ok) {
      return NextResponse.json(
        {
          error: "api_error",
          mensaje: `La API (${esOR ? "OpenRouter" : "Anthropic"}) respondió ${r.status}. Verificá que la clave sea válida.`,
          detalle: r.detalle,
        },
        { status: 502 }
      );
    }
    if (!r.texto || r.texto.trim() === "") {
      return NextResponse.json(
        {
          error: "respuesta_vacia",
          mensaje: "El modelo devolvió una respuesta vacía (dos veces).",
        },
        { status: 502 }
      );
    }
    return NextResponse.json({ respuesta: r.texto });
  } catch {
    return NextResponse.json(
      { error: "red", mensaje: "No se pudo contactar la API de IA." },
      { status: 502 }
    );
  }
}
