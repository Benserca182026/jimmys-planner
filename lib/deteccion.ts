// Detección de datos sepultados en el texto libre de las tareas.
//
// POR QUÉ EXISTE ESTE ARCHIVO: el score de prioridad sólo puede juzgar sobre
// campos estructurados (prioridad, fecha, confirmada). Es ciego a lo que está
// escrito dentro del texto — y ahí hay fechas reales. Ejemplo del propio Excel:
// "Invitación viaje 19-20/8 México" no tiene el campo `fecha` cargado, así que
// para el ranking vale cero, aunque el viaje sea la semana que viene.
//
// Esto NO usa IA: son reglas explícitas sobre cómo escribe Jimmy. Es el caso
// típico de un hallazgo que se repite siempre y por eso se escribe como regla.

import type { Tarea } from "./estado";

export type Precision = "dia" | "mes";

export interface HallazgoTexto {
  idTarea: number;
  empresa: string;
  tema: string;
  /** Fragmento textual exacto de donde salió: sin esto no es verificable. */
  cita: string;
  /** Fecha resuelta en formato dd/mm, lista para cargar en el campo. */
  etiqueta: string;
  fechaISO: string;
  precision: Precision;
  /** Qué regla lo encontró, para poder discutirla. */
  regla: string;
  /** Días desde hoy (negativo = ya pasó). */
  dias: number;
}

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12,
};

const dd = (n: number) => String(n).padStart(2, "0");

/**
 * Elige el año más razonable: el que deje la fecha más cerca de hoy sin quedar
 * absurdamente en el pasado (más de 3 meses atrás → se asume el año siguiente).
 */
function resolverAnio(mes: number, dia: number, hoy: Date): number {
  const anio = hoy.getFullYear();
  const candidata = new Date(anio, mes - 1, dia);
  const tresMeses = 92 * 24 * 60 * 60 * 1000;
  if (hoy.getTime() - candidata.getTime() > tresMeses) return anio + 1;
  return anio;
}

/**
 * Interpreta el "dd/mm" del tablero como fecha real, infiriendo el año más
 * razonable. Devuelve null si el campo está vacío o es ilegible.
 */
export function parsearFechaCorta(fecha: string | undefined, hoy: Date): Date | null {
  if (!fecha) return null;
  const m = fecha.match(/^(\d{1,2})\s*\/\s*(\d{1,2})$/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const f = new Date(resolverAnio(mes, dia, hoy), mes - 1, dia);
  return f.getMonth() === mes - 1 ? f : null;
}

/** Días entre una fecha y hoy. Negativo = ya pasó. */
export function diasHasta(f: Date, hoy: Date): number {
  return diasDesdeHoy(f, hoy);
}

function diasDesdeHoy(f: Date, hoy: Date): number {
  const a = new Date(f.getFullYear(), f.getMonth(), f.getDate()).getTime();
  const b = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
  return Math.round((a - b) / (24 * 60 * 60 * 1000));
}

/**
 * Busca fechas escritas dentro del texto de tareas que NO tienen el campo
 * `fecha` cargado. Sólo esas: si el campo ya está, la regla no es ciega.
 */
export function detectarFechasOcultas(tareas: Tarea[], hoy: Date): HallazgoTexto[] {
  const hallazgos: HallazgoTexto[] = [];

  for (const t of tareas) {
    if (t.estado === "listo" || t.fecha) continue;
    const texto = t.tema;

    // Regla 1 — rango de días con mes: "19-20/8", "19 - 20 / 08".
    // Se toma el primer día del rango (el compromiso arranca ahí).
    const rango = texto.match(/(\d{1,2})\s*[-–a]\s*(\d{1,2})\s*\/\s*(\d{1,2})/);
    // Regla 2 — día y mes sueltos: "20/07".
    const suelta = texto.match(/(?<![\d/])(\d{1,2})\s*\/\s*(\d{1,2})(?![\d/])/);
    // Regla 3 — mes escrito con palabras: "septiembre", "junio 2026".
    const conNombre = texto
      .toLowerCase()
      .match(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/);

    let dia: number | null = null;
    let mes: number | null = null;
    let cita = "";
    let precision: Precision = "dia";
    let regla = "";

    if (rango) {
      dia = Number(rango[1]);
      mes = Number(rango[3]);
      cita = rango[0];
      regla = "rango de días con mes escrito en el texto (ej. 19-20/8)";
    } else if (suelta) {
      dia = Number(suelta[1]);
      mes = Number(suelta[2]);
      cita = suelta[0];
      regla = "día/mes escrito en el texto (ej. 20/07)";
    } else if (conNombre) {
      mes = MESES[conNombre[1]];
      dia = 1;
      precision = "mes";
      cita = conNombre[0];
      regla = "nombre de mes en el texto — sin día, se marca el inicio del mes";
    }

    if (dia === null || mes === null) continue;
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) continue;

    const anio = resolverAnio(mes, dia, hoy);
    const fecha = new Date(anio, mes - 1, dia);
    // Descarta combinaciones inexistentes (31/02 y similares).
    if (fecha.getMonth() !== mes - 1) continue;

    hallazgos.push({
      idTarea: t.id,
      empresa: t.empresa,
      tema: t.tema,
      cita,
      etiqueta: precision === "mes" ? `${dd(mes)}` : `${dd(dia)}/${dd(mes)}`,
      fechaISO: `${anio}-${dd(mes)}-${dd(dia)}`,
      precision,
      regla,
      dias: diasDesdeHoy(fecha, hoy),
    });
  }

  // Lo más cercano primero: es lo que más apremia.
  return hallazgos.sort((a, b) => a.dias - b.dias);
}
