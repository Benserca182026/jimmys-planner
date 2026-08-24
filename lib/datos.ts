// Datos reales transcritos de "Agenda 17_07.xlsx" (Descargas, 2026-08-11).
// Hoja "12_17" → pendientes · Hoja "To Fast" → catálogo de agendas por tipo.

export type Estado = "pendiente" | "agendado" | "listo";

export type Categoria =
  | "Dirección"
  | "Comercial"
  | "Agenda interna"
  | "Motos"
  | "Compras"
  | "Regional"
  | "Legal-Admin"
  | "Personal";

export const COLORES_CATEGORIA: Record<
  Categoria,
  { fondo: string; borde: string; texto: string; punto: string }
> = {
  Dirección: { fondo: "#eef2ff", borde: "#c7d2fe", texto: "#3730a3", punto: "#6366f1" },
  Comercial: { fondo: "#fff4e6", borde: "#fde0b8", texto: "#9a5b13", punto: "#f0a13a" },
  "Agenda interna": { fondo: "#e8edff", borde: "#c5d1ff", texto: "#2540c0", punto: "#3b5bfd" },
  Motos: { fondo: "#e6f7f5", borde: "#bcebe5", texto: "#0d6e66", punto: "#12b3a8" },
  Compras: { fondo: "#fdf0f6", borde: "#f9d2e6", texto: "#a3315f", punto: "#ec4899" },
  Regional: { fondo: "#e9f8fd", borde: "#c3ecf8", texto: "#0e6d8c", punto: "#0ea5e9" },
  "Legal-Admin": { fondo: "#f3efff", borde: "#ddd2fb", texto: "#5b34a8", punto: "#8b5cf6" },
  Personal: { fondo: "#f1f4f8", borde: "#dbe2ec", texto: "#475569", punto: "#64748b" },
};

/** Agenda a la que pertenece una tarea (ids de AGENDAS, más abajo). */
export type AgendaId = "mexico" | "latam" | "varias" | "latam-oil";

export interface Pendiente {
  id: number;
  empresa: string;
  tema: string;
  categoria: Categoria;
  estado: Estado;
  /** Agenda dueña de la tarea; sin valor = no asignada a ninguna agenda. */
  agenda?: AgendaId;
  prioridad?: "Urgente" | "A";
  involucrados?: string;
  fecha?: string;
  confirmada?: "Si" | "No";
  observaciones?: string;
}

// Estado: "listo" solo si la hoja lo dice; "agendado" si tiene fecha programada; el resto "pendiente".
export const PENDIENTES: Pendiente[] = [
  { id: 1, agenda: "varias", empresa: "Abraham Jai", tema: "Scooters, incard, fusionar Edge pty", categoria: "Dirección", estado: "pendiente", involucrados: "Daniel" },
  { id: 2, agenda: "latam", empresa: "Ventas", tema: "Scooters ofrecer clientes retail", categoria: "Dirección", estado: "pendiente" },
  { id: 3, agenda: "mexico", empresa: "Residencia", tema: "Ojo requisitos México", categoria: "Dirección", estado: "pendiente", prioridad: "Urgente", involucrados: "Mercedez" },
  { id: 4, agenda: "latam", empresa: "Rappi", tema: "Muestras + pedido nacional", categoria: "Comercial", estado: "pendiente" },
  { id: 5, agenda: "latam", empresa: "Casa Pellas", tema: "Genesis aprobado + forecast + contrato + viaje pty y nic", categoria: "Comercial", estado: "pendiente" },
  { id: 6, agenda: "latam", empresa: "Casa Pellas", tema: "El Salvador — ofrecer productos", categoria: "Comercial", estado: "pendiente" },
  { id: 7, agenda: "mexico", empresa: "Coppel", tema: "Oneal aprobado + visera night vision + vtrust + DOT en componentes", categoria: "Comercial", estado: "pendiente" },
  { id: 8, agenda: "mexico", empresa: "Coppel", tema: "Status pedido de ropa Oneal", categoria: "Comercial", estado: "pendiente" },
  { id: 9, agenda: "mexico", empresa: "Coppel", tema: "Invitación viaje 19-20/8 México", categoria: "Comercial", estado: "pendiente" },
  { id: 10, agenda: "mexico", empresa: "Coppel", tema: "Vtrust, auditoría primer pedido calidad", categoria: "Comercial", estado: "pendiente" },
  { id: 11, agenda: "mexico", empresa: "Coppel", tema: "DOT: agregar el código de Oneal e importador", categoria: "Comercial", estado: "pendiente" },
  { id: 12, agenda: "mexico", empresa: "Coppel", tema: "Visita fábricas en China en septiembre con ellos", categoria: "Comercial", estado: "pendiente" },
  { id: 13, agenda: "latam", empresa: "Fanalca", tema: "Honda aprobado, seguimiento", categoria: "Comercial", estado: "pendiente" },
  { id: 14, agenda: "latam", empresa: "Fanalca", tema: "Reunión + productos nuevos", categoria: "Comercial", estado: "pendiente" },
  { id: 15, agenda: "latam", empresa: "Sunapa", tema: "Edge aprobado ver agenda — ojo etiquetas DOT + pedido accesorios", categoria: "Comercial", estado: "pendiente" },
  { id: 16, agenda: "mexico", empresa: "Moto Mex", tema: "Ver agenda y avanzar + cliente OEM", categoria: "Comercial", estado: "pendiente", involucrados: "Andres" },
  { id: 17, agenda: "mexico", empresa: "Inusa", tema: "Estrategia TikTok + nuevos productos + mkt + licencia", categoria: "Comercial", estado: "listo", fecha: "20/07", confirmada: "Si" },
  { id: 18, agenda: "mexico", empresa: "Zune Sears Mex", tema: "Cambio de calotas — proyecto OEM", categoria: "Comercial", estado: "pendiente" },
  { id: 19, agenda: "mexico", empresa: "Bodesa Mex", tema: "Scooters — proyecto OEM", categoria: "Comercial", estado: "pendiente" },
  { id: 20, agenda: "latam", empresa: "Mavi Me", tema: "Seguimiento agenda", categoria: "Comercial", estado: "pendiente" },
  { id: 21, agenda: "latam", empresa: "Muestras OEM", tema: "Proyectos muestras OEM por adelantado", categoria: "Comercial", estado: "pendiente", involucrados: "Karina/vendedores" },
  { id: 22, agenda: "latam", empresa: "Agenda", tema: "Nuevas ideas ventas Latam", categoria: "Agenda interna", estado: "pendiente" },
  { id: 23, agenda: "varias", empresa: "Agenda", tema: "IA", categoria: "Agenda interna", estado: "pendiente" },
  { id: 24, agenda: "latam", empresa: "Agenda", tema: "Ghilel", categoria: "Agenda interna", estado: "pendiente" },
  { id: 25, agenda: "latam", empresa: "Agenda", tema: "Andres", categoria: "Agenda interna", estado: "pendiente" },
  { id: 26, agenda: "latam", empresa: "Clientes Latam", tema: "Invitaciones VIP + agendas c/u", categoria: "Agenda interna", estado: "pendiente" },
  { id: 27, agenda: "varias", empresa: "Motos", tema: "Forza-Jsl: nuevos modelos + forecast proyección", categoria: "Motos", estado: "pendiente" },
  { id: 28, agenda: "varias", empresa: "Motos Yes", tema: "Reunión + contratos + apuntes", categoria: "Motos", estado: "agendado", fecha: "20/07", confirmada: "No" },
  { id: 29, agenda: "varias", empresa: "Motos Yes", tema: "App Benmo + todo", categoria: "Motos", estado: "pendiente" },
  { id: 30, agenda: "varias", empresa: "Apuntes", tema: "Benmo", categoria: "Motos", estado: "pendiente" },
  { id: 31, agenda: "varias", empresa: "Linkid", tema: "Ver planes, lead y estrategia + ver proceso", categoria: "Comercial", estado: "pendiente" },
  { id: 32, agenda: "varias", empresa: "USA", tema: "Declaraciones contabilidad", categoria: "Regional", estado: "pendiente", prioridad: "A" },
  { id: 33, agenda: "latam", empresa: "Compras", tema: "Ver avances de producción y diseños colecciones", categoria: "Compras", estado: "pendiente" },
  { id: 34, agenda: "latam", empresa: "Compras", tema: "Accesorios mix todas las sucursales", categoria: "Compras", estado: "pendiente" },
  { id: 35, agenda: "latam", empresa: "Compras", tema: "Guantes de Pakistán", categoria: "Compras", estado: "pendiente" },
  { id: 36, agenda: "varias", empresa: "GT", tema: "CxC, VRC, mkt Andres", categoria: "Regional", estado: "pendiente" },
  { id: 37, agenda: "varias", empresa: "GT", tema: "Abogado Crowleay", categoria: "Regional", estado: "agendado", fecha: "20/07", confirmada: "Si", observaciones: "Enviar carta" },
  { id: 38, agenda: "mexico", empresa: "Mex", tema: "Agenda + Miguel %", categoria: "Regional", estado: "pendiente" },
  { id: 39, agenda: "mexico", empresa: "Mex", tema: "Reportes junio 2026", categoria: "Regional", estado: "pendiente" },
  { id: 40, agenda: "mexico", empresa: "Mex", tema: "eCommerce + toma pedido + Yael propuesta", categoria: "Regional", estado: "pendiente" },
  { id: 41, agenda: "mexico", empresa: "Mex", tema: "Plan de mercadeo", categoria: "Regional", estado: "pendiente" },
  { id: 42, agenda: "mexico", empresa: "Mex", tema: "Regalo Miguel y accesorios", categoria: "Regional", estado: "pendiente" },
  { id: 43, agenda: "latam", empresa: "Lista", tema: "Nueva lista, PDF accesorios", categoria: "Legal-Admin", estado: "pendiente" },
  { id: 44, agenda: "latam", empresa: "Contratos-Legal", tema: "Fábricas + NDA", categoria: "Legal-Admin", estado: "pendiente" },
  { id: 45, agenda: "latam", empresa: "Contratos-Legal", tema: "Clientes + NDA", categoria: "Legal-Admin", estado: "pendiente" },
  { id: 46, agenda: "varias", empresa: "Colombia", tema: "Reunión socios: resultados, Edge Tyre, Shad, portafolio", categoria: "Regional", estado: "pendiente" },
  { id: 47, agenda: "latam", empresa: "Dimary", tema: "Excel accesorios", categoria: "Legal-Admin", estado: "pendiente", involucrados: "Dimary" },
  { id: 48, agenda: "varias", empresa: "Todos", tema: "Cuadro de máster", categoria: "Legal-Admin", estado: "pendiente" },
  { id: 49, empresa: "Personal", tema: "Papeles moto Piaggio", categoria: "Personal", estado: "pendiente" },
  { id: 50, empresa: "Personal", tema: "Traspasos carros Jimmy", categoria: "Personal", estado: "pendiente" },
  { id: 51, agenda: "varias", empresa: "Legal", tema: "Registro de marca Edge USA y Europa — conflicto", categoria: "Legal-Admin", estado: "pendiente" },
];

// ── Catálogo de agendas (hoja "To Fast") ──

export type Frecuencia = "Semanal" | "Quincenal" | "Mensual" | "Sin definir";

export interface ItemAgenda {
  nombre: string;
  frecuencia: Frecuencia;
  nota?: string;
}

export interface GrupoAgenda {
  id: string;
  nombre: string;
  color: string;
  colorSuave: string;
  items: ItemAgenda[];
}

export const AGENDAS: GrupoAgenda[] = [
  {
    id: "mexico",
    nombre: "Agenda México",
    color: "#3b5bfd",
    colorSuave: "#e8edff",
    items: [
      { nombre: "Agenda Isaac", frecuencia: "Semanal" },
      { nombre: "Agenda Admin (Mercedez + Aracelis)", frecuencia: "Quincenal" },
      { nombre: "Agenda Fortu Melul (Local + Represent)", frecuencia: "Mensual" },
      { nombre: "Reports de ventas + CxC + Metas", frecuencia: "Mensual" },
      { nombre: "Agenda Mercadeo", frecuencia: "Quincenal" },
      { nombre: "Agenda eCommerce", frecuencia: "Mensual" },
      { nombre: "Reporte General", frecuencia: "Mensual" },
      { nombre: "Agenda de Allan", frecuencia: "Mensual" },
      { nombre: "Agenda Fortu Melul (Local + Represent)", frecuencia: "Quincenal" },
      { nombre: "Reuniones vendedores", frecuencia: "Mensual" },
      { nombre: "Reunión status retails", frecuencia: "Mensual" },
      { nombre: "Reunión vendedores (Metas + promo)", frecuencia: "Sin definir" },
    ],
  },
  {
    id: "latam",
    nombre: "Agenda Latam",
    color: "#12b3a8",
    colorSuave: "#e6f7f5",
    items: [
      { nombre: "Ventas Latam + viajes + prospectos", frecuencia: "Quincenal" },
      { nombre: "Clientes activos forecast + mkt", frecuencia: "Quincenal" },
      { nombre: "Agenda Ghilel y Andres", frecuencia: "Quincenal" },
      { nombre: "Agenda admin", frecuencia: "Quincenal" },
      { nombre: "Agenda compras", frecuencia: "Quincenal" },
      { nombre: "Agenda operaciones + forecast + desarrollo", frecuencia: "Quincenal" },
      { nombre: "Status diseños Edge + moldes", frecuencia: "Quincenal" },
      { nombre: "Status diseños licencias", frecuencia: "Quincenal" },
      { nombre: "Status nuevos productos", frecuencia: "Quincenal" },
      { nombre: "Plan de mercadeo + mkt digital más 360°", frecuencia: "Mensual" },
    ],
  },
  {
    id: "varias",
    nombre: "Agenda Varias",
    color: "#f0a13a",
    colorSuave: "#fff4e6",
    items: [
      { nombre: "Jsl Motos (Forza, Vento)", frecuencia: "Quincenal" },
      { nombre: "Jsl Motos (consumibles)", frecuencia: "Quincenal", nota: "sistema de fac / AI / ventas y mercadeo" },
      { nombre: "Motos Yes", frecuencia: "Mensual", nota: "Planta / Shai / Joseph" },
      { nombre: "Benserca 18 GT", frecuencia: "Mensual" },
      { nombre: "Colombia Grupo Or H", frecuencia: "Mensual" },
      { nombre: "JB Imports + Internacional", frecuencia: "Mensual" },
      { nombre: "Benmo 1 a Bello", frecuencia: "Mensual" },
      { nombre: "Socios", frecuencia: "Mensual" },
    ],
  },
  {
    id: "latam-oil",
    nombre: "Latam Oil",
    color: "#8b5cf6",
    colorSuave: "#f3efff",
    items: [
      { nombre: "Construcción", frecuencia: "Sin definir" },
      { nombre: "Bicicletas Latam", frecuencia: "Sin definir" },
      { nombre: "Ferretov, spray, bici", frecuencia: "Sin definir" },
      { nombre: "Elektra", frecuencia: "Sin definir" },
    ],
  },
];

// ── Vista mensual (sección original del planner, se conserva y va arriba) ──

export interface MesResumen {
  mes: string;
  estadoMes: "cerrado" | "a la fecha";
  enCurso?: boolean;
  listo: number;
  enProceso: number;
  terminado: number;
}

export const VISTA_MENSUAL: MesResumen[] = [
  { mes: "Mayo", estadoMes: "cerrado", listo: 5, enProceso: 6, terminado: 7 },
  { mes: "Junio", estadoMes: "cerrado", listo: 4, enProceso: 7, terminado: 7 },
  { mes: "Julio", estadoMes: "a la fecha", enCurso: true, listo: 6, enProceso: 9, terminado: 6 },
];

// ── Vista semanal — Julio 2026 (sección del planner original, para la subpágina del mes) ──

export interface SemanaResumen {
  semana: string;
  rango: string;
  enCurso?: boolean;
  listo: number;
  enProceso: number;
  terminado: number;
}

export const VISTA_SEMANAL_JULIO: SemanaResumen[] = [
  { semana: "Semana 1", rango: "1–7 jul", listo: 5, enProceso: 10, terminado: 7 },
  { semana: "Semana 2", rango: "8–14 jul", listo: 4, enProceso: 12, terminado: 6 },
  { semana: "Semana 3", rango: "15–21 jul", enCurso: true, listo: 6, enProceso: 11, terminado: 5 },
  { semana: "Semana 4", rango: "22–31 jul", listo: 4, enProceso: 8, terminado: 5 },
];
