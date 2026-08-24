// SKILLS del agente — herramientas de análisis PURAMENTE programadas.
// Sin IA: cada skill es una función determinística sobre las tareas que
// devuelve un resultado visual (barras, rankings, listas). Instantáneas,
// exactas y gratis.

import { COLORES_CATEGORIA, type Categoria } from "./datos";
import type { Tarea } from "./estado";

// ── Tipos de resultado visual que las skills pueden producir ──

export interface Barra {
  etiqueta: string;
  valor: number;
  pct: number; // 0-100 relativo al máximo
  color: string;
  detalle?: string;
}

export interface FilaRanking {
  posicion: number;
  titulo: string;
  subtitulo?: string;
  valor: string;
  color?: string;
  destacada?: boolean;
}

export interface SeccionSkill {
  titulo: string;
  tipo: "barras" | "ranking" | "kpis";
  barras?: Barra[];
  filas?: FilaRanking[];
  kpis?: { etiqueta: string; valor: string; color?: string }[];
  nota?: string;
}

export interface ResultadoSkill {
  resumen: string; // una línea de conclusión, calculada
  secciones: SeccionSkill[];
}

export interface Skill {
  id: string;
  nombre: string;
  icono: string;
  descripcion: string;
  ejecutar: (tareas: Tarea[]) => ResultadoSkill;
}

const pct = (n: number, total: number) =>
  total > 0 ? Math.round((n / total) * 100) : 0;

// ── SKILL 1: Análisis de prioridad ──
// Score programado: prioridad marcada (+50 Urgente / +30 A), tiene fecha sin
// confirmar (+15), categoría más cargada (+10), tiene comentarios (+5).
const analisisPrioridad: Skill = {
  id: "prioridad",
  nombre: "Análisis de prioridad",
  icono: "🎯",
  descripcion: "Ranking de qué atender primero, con score calculado por reglas",
  ejecutar: (tareas) => {
    const abiertas = tareas.filter((t) => t.estado !== "listo");
    const porCategoria = new Map<string, number>();
    abiertas.forEach((t) =>
      porCategoria.set(t.categoria, (porCategoria.get(t.categoria) ?? 0) + 1)
    );
    const masCargada = [...porCategoria.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

    const puntuadas = abiertas.map((t) => {
      let score = 0;
      const razones: string[] = [];
      if (t.prioridad === "Urgente") { score += 50; razones.push("marcada URGENTE"); }
      if (t.prioridad === "A") { score += 30; razones.push("prioridad A"); }
      if (t.fecha && t.confirmada === "No") { score += 15; razones.push("fecha sin confirmar"); }
      else if (t.fecha) { score += 10; razones.push(`fecha ${t.fecha}`); }
      if (t.categoria === masCargada) { score += 10; razones.push("categoría más cargada"); }
      if (t.comentarios.length > 0) { score += 5; razones.push("tiene actividad"); }
      return { t, score, razones };
    });
    const top = puntuadas.sort((a, b) => b.score - a.score).slice(0, 10);

    return {
      resumen: `${abiertas.length} tareas abiertas evaluadas — la número 1 a atender: ${top[0]?.t.empresa ?? "n/a"} (${top[0]?.t.tema.slice(0, 40) ?? ""}).`,
      secciones: [
        {
          titulo: "Top 10 por score de prioridad (reglas programadas)",
          tipo: "ranking",
          filas: top.map((p, i) => ({
            posicion: i + 1,
            titulo: p.t.empresa,
            subtitulo: `${p.t.tema.slice(0, 60)}${p.t.tema.length > 60 ? "…" : ""} · ${p.razones.join(", ") || "sin señales extra"}`,
            valor: `${p.score} pts`,
            color: COLORES_CATEGORIA[p.t.categoria].punto,
            destacada: i === 0,
          })),
          nota: "Score: Urgente +50 · Prioridad A +30 · fecha sin confirmar +15 · con fecha +10 · categoría más cargada +10 · con actividad +5",
        },
      ],
    };
  },
};

// ── SKILL 2: Carga por categoría ──
const cargaCategorias: Skill = {
  id: "carga",
  nombre: "Carga por categoría",
  icono: "📊",
  descripcion: "Dónde está concentrado el trabajo, con porcentajes exactos",
  ejecutar: (tareas) => {
    const total = tareas.length;
    const porCategoria = new Map<Categoria, Tarea[]>();
    tareas.forEach((t) => {
      porCategoria.set(t.categoria, [...(porCategoria.get(t.categoria) ?? []), t]);
    });
    const orden = [...porCategoria.entries()].sort((a, b) => b[1].length - a[1].length);
    const max = orden[0]?.[1].length ?? 1;
    const top3 = orden.slice(0, 3).reduce((s, [, ts]) => s + ts.length, 0);

    return {
      resumen: `Las 3 categorías más cargadas concentran ${pct(top3, total)}% del trabajo (${top3} de ${total} tareas).`,
      secciones: [
        {
          titulo: "Distribución de tareas",
          tipo: "barras",
          barras: orden.map(([cat, ts]) => ({
            etiqueta: cat,
            valor: ts.length,
            pct: Math.round((ts.length / max) * 100),
            color: COLORES_CATEGORIA[cat].punto,
            detalle: `${ts.length} tareas · ${pct(ts.length, total)}% del total · ${ts.filter((t) => t.estado === "pendiente").length} pendientes`,
          })),
        },
      ],
    };
  },
};

// ── SKILL 3: Radar de fechas ──
const radarFechas: Skill = {
  id: "fechas",
  nombre: "Radar de fechas",
  icono: "📅",
  descripcion: "Qué está agendado, qué falta confirmar y qué no tiene fecha",
  ejecutar: (tareas) => {
    const abiertas = tareas.filter((t) => t.estado !== "listo");
    const conFecha = abiertas.filter((t) => t.fecha);
    const sinConfirmar = conFecha.filter((t) => t.confirmada === "No");
    const confirmadas = conFecha.filter((t) => t.confirmada === "Si");
    const sinFecha = abiertas.filter((t) => !t.fecha);

    return {
      resumen:
        conFecha.length === 0
          ? "Ninguna tarea abierta tiene fecha programada — todo el tablero está sin agendar."
          : `${conFecha.length} tareas con fecha (${sinConfirmar.length} sin confirmar) · ${sinFecha.length} abiertas sin fecha.`,
      secciones: [
        {
          titulo: "Estado de agendamiento",
          tipo: "kpis",
          kpis: [
            { etiqueta: "Con fecha confirmada", valor: String(confirmadas.length), color: "#12b3a8" },
            { etiqueta: "Fecha sin confirmar", valor: String(sinConfirmar.length), color: "#f0a13a" },
            { etiqueta: "Abiertas sin fecha", valor: String(sinFecha.length), color: "#d14343" },
          ],
        },
        {
          titulo: "Tareas con fecha",
          tipo: "ranking",
          filas: conFecha.map((t, i) => ({
            posicion: i + 1,
            titulo: `${t.empresa} · 📅 ${t.fecha}`,
            subtitulo: t.tema.slice(0, 70),
            valor: t.confirmada === "Si" ? "✓ confirmada" : "sin confirmar",
            color: t.confirmada === "Si" ? "#12b3a8" : "#f0a13a",
            destacada: t.confirmada === "No",
          })),
          nota: sinFecha.length > 0 ? `⚠️ ${sinFecha.length} tareas abiertas no tienen ninguna fecha — candidatas a agendar.` : undefined,
        },
      ],
    };
  },
};

// ── SKILL 4: Top empresas ──
const topEmpresas: Skill = {
  id: "empresas",
  nombre: "Top empresas",
  icono: "🏆",
  descripcion: "Qué empresas concentran más tareas abiertas",
  ejecutar: (tareas) => {
    const abiertas = tareas.filter((t) => t.estado !== "listo");
    const porEmpresa = new Map<string, Tarea[]>();
    abiertas.forEach((t) => {
      porEmpresa.set(t.empresa, [...(porEmpresa.get(t.empresa) ?? []), t]);
    });
    const orden = [...porEmpresa.entries()].sort((a, b) => b[1].length - a[1].length);
    const max = orden[0]?.[1].length ?? 1;

    return {
      resumen: `${porEmpresa.size} empresas/frentes con tareas abiertas — ${orden[0]?.[0]} lidera con ${orden[0]?.[1].length}.`,
      secciones: [
        {
          titulo: "Ranking por volumen de tareas abiertas",
          tipo: "barras",
          barras: orden.slice(0, 12).map(([emp, ts]) => ({
            etiqueta: emp,
            valor: ts.length,
            pct: Math.round((ts.length / max) * 100),
            color: COLORES_CATEGORIA[ts[0].categoria].punto,
            detalle: ts.map((t) => t.tema.slice(0, 30)).join(" · ").slice(0, 90),
          })),
        },
      ],
    };
  },
};

// ── SKILL 5: Salud del tablero ──
const saludTablero: Skill = {
  id: "salud",
  nombre: "Salud del tablero",
  icono: "🩺",
  descripcion: "Foto general: avance, actividad y señales de alerta",
  ejecutar: (tareas) => {
    const total = tareas.length;
    const listas = tareas.filter((t) => t.estado === "listo").length;
    const agendadas = tareas.filter((t) => t.estado === "agendado").length;
    const pendientes = tareas.filter((t) => t.estado === "pendiente").length;
    const conActividad = tareas.filter((t) => t.comentarios.length > 0 || t.adjuntos.length > 0);
    const urgentesSinFecha = tareas.filter((t) => t.prioridad && !t.fecha && t.estado !== "listo");

    const avance = pct(listas + agendadas, total);
    return {
      resumen: `Avance operativo: ${avance}% (listas + agendadas). ${urgentesSinFecha.length > 0 ? `⚠️ ${urgentesSinFecha.length} tarea(s) con prioridad y SIN fecha.` : "Sin urgencias desatendidas."}`,
      secciones: [
        {
          titulo: "Estado del tablero",
          tipo: "kpis",
          kpis: [
            { etiqueta: "Pendientes", valor: `${pendientes} (${pct(pendientes, total)}%)`, color: "#f0a13a" },
            { etiqueta: "Agendadas", valor: `${agendadas} (${pct(agendadas, total)}%)`, color: "#12b3a8" },
            { etiqueta: "Listas", valor: `${listas} (${pct(listas, total)}%)`, color: "#3b5bfd" },
            { etiqueta: "Con actividad (💬/📎)", valor: `${conActividad.length}`, color: "#8b5cf6" },
          ],
        },
        {
          titulo: "Señales de alerta (calculadas)",
          tipo: "ranking",
          filas: [
            ...urgentesSinFecha.map((t, i) => ({
              posicion: i + 1,
              titulo: `${t.empresa} — ${t.tema.slice(0, 50)}`,
              subtitulo: `Prioridad ${t.prioridad} pero sin fecha programada`,
              valor: "agendar ya",
              color: "#d14343",
              destacada: true,
            })),
            ...(urgentesSinFecha.length === 0
              ? [{ posicion: 1, titulo: "Sin alertas críticas", subtitulo: "Ninguna tarea prioritaria está sin fecha", valor: "✓", color: "#12b3a8" }]
              : []),
          ],
        },
      ],
    };
  },
};

export const SKILLS: Skill[] = [
  analisisPrioridad,
  cargaCategorias,
  radarFechas,
  topEmpresas,
  saludTablero,
];
