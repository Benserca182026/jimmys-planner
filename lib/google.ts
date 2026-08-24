// Conexión con Google Calendar (servidor únicamente).
//
// CUSTODIA DEL SECRETO: nada de este archivo puede correr en el navegador. El
// Client Secret y el refresh token viven como variables de entorno; el token de
// acceso se genera al vuelo y no se guarda en ningún lado.
//
// Variables necesarias (.env.local en local, y en Vercel para producción):
//   GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET
//   GOOGLE_REDIRECT_URI      · ej. http://localhost:3000/api/google/callback
//   GOOGLE_REFRESH_TOKEN     · se obtiene una sola vez, con /api/google/iniciar
//   GOOGLE_CALENDAR_ID       · opcional; por defecto "primary"

/** Mínimo indispensable: leer, crear y mover eventos. Nada más. */
export const ALCANCE = "https://www.googleapis.com/auth/calendar.events";

/** Marca que llevan todos los eventos creados por el tablero. */
export const MARCA_APP = "jimmys-planner";

// ── VÍA A: CUENTA DE SERVICIO ──
// El calendario se comparte con el correo de la cuenta de servicio (igual que
// se comparte con una persona), y desde ahí el servidor escribe solo: sin
// pantalla de consentimiento, sin autorización manual, sin token que caduque.
// Es el "mecanismo exterior" que faltaba.
//
//   GOOGLE_SA_EMAIL        · correo de la cuenta de servicio
//   GOOGLE_SA_PRIVATE_KEY  · la clave privada del JSON (con \n escapados)
//   GOOGLE_CALENDAR_ID     · id del calendario compartido — NO sirve "primary",
//                            porque la cuenta de servicio no tiene calendario propio
export function configuracionSA() {
  return {
    email: process.env.GOOGLE_SA_EMAIL ?? "",
    // En variables de entorno los saltos de línea viajan escapados.
    clave: (process.env.GOOGLE_SA_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  };
}

export function hayCuentaDeServicio(): boolean {
  const sa = configuracionSA();
  return !!sa.email && !!sa.clave;
}

const base64url = (b: Buffer | string) =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/**
 * Token por cuenta de servicio: se firma un JWT con la clave privada y se
 * canjea. No hay usuario, no hay consentimiento, no hay caducidad de 7 días.
 */
async function tokenDeServicio(): Promise<string> {
  const { createSign } = await import("node:crypto");
  const sa = configuracionSA();
  const ahora = Math.floor(Date.now() / 1000);
  const cabecera = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const cuerpo = base64url(
    JSON.stringify({
      iss: sa.email,
      scope: ALCANCE,
      aud: "https://oauth2.googleapis.com/token",
      iat: ahora,
      exp: ahora + 3600,
    })
  );
  const firma = createSign("RSA-SHA256").update(`${cabecera}.${cuerpo}`).end().sign(sa.clave);
  const jwt = `${cabecera}.${cuerpo}.${base64url(firma)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      data?.error_description ?? "La cuenta de servicio no pudo obtener token."
    );
  }
  return data.access_token as string;
}

export function configuracion() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? "",
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN ?? "",
    calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
  };
}

/** Qué falta configurar, para poder decirlo con precisión en pantalla. */
export function loQueFalta(): string[] {
  const c = configuracion();
  const falta: string[] = [];
  if (!c.clientId) falta.push("GOOGLE_CLIENT_ID");
  if (!c.clientSecret) falta.push("GOOGLE_CLIENT_SECRET");
  if (!c.redirectUri) falta.push("GOOGLE_REDIRECT_URI");
  return falta;
}

/** URL a la que se manda al usuario para que autorice, una sola vez. */
export function urlDeConsentimiento(): string {
  const c = configuracion();
  const p = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: c.redirectUri,
    response_type: "code",
    scope: ALCANCE,
    // offline + consent son los que hacen que Google entregue refresh_token.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

/** Canjea el código de un solo uso por los tokens. */
export async function canjearCodigo(codigo: string) {
  const c = configuracion();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: codigo,
      client_id: c.clientId,
      client_secret: c.clientSecret,
      redirect_uri: c.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error_description ?? "No se pudo canjear el código.");
  return data as { access_token: string; refresh_token?: string; expires_in: number };
}

/**
 * Token de acceso a partir del refresh token guardado. Dura una hora y se pide
 * de nuevo cada vez: no se cachea a propósito, para no guardar credenciales.
 */
export async function tokenDeAcceso(): Promise<string> {
  // La cuenta de servicio manda: no necesita a nadie presente ni caduca.
  if (hayCuentaDeServicio()) return tokenDeServicio();
  const c = configuracion();
  if (!c.refreshToken)
    throw new Error(
      "No hay forma de autenticarse: falta la cuenta de servicio (GOOGLE_SA_EMAIL + GOOGLE_SA_PRIVATE_KEY) o el GOOGLE_REFRESH_TOKEN."
    );
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: c.refreshToken,
      client_id: c.clientId,
      client_secret: c.clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error_description ?? "No se pudo renovar el token.");
  return data.access_token as string;
}

export interface EventoNuevo {
  titulo: string;
  descripcion?: string;
  /** Inicio en hora local, formato "2026-08-19T10:00" (el del input del navegador). */
  inicio: string;
  minutos?: number;
  invitados?: string[];
  zonaHoraria?: string;
  /** Aviso emergente, en minutos antes. Por defecto 30. */
  avisoMinutos?: number;
  /** Correo de anticipación, en minutos antes. Por defecto 1 día. */
  avisoCorreoMinutos?: number;
  /** Marca propia: así el tablero reconoce después los eventos que él creó. */
  idTarea?: number;
}

/** Crea el evento y devuelve su id y su link. */
export async function crearEvento(ev: EventoNuevo) {
  const c = configuracion();
  const token = await tokenDeAcceso();
  const inicio = new Date(ev.inicio);
  const fin = new Date(inicio.getTime() + (ev.minutos ?? 60) * 60000);
  const zona = ev.zonaHoraria || "America/Panama";

  const cuerpo: Record<string, unknown> = {
    summary: ev.titulo,
    description: ev.descripcion,
    start: { dateTime: inicio.toISOString(), timeZone: zona },
    end: { dateTime: fin.toISOString(), timeZone: zona },
    // Recordatorios explícitos: no se deja al azar de la configuración del
    // calendario. Uno emergente antes de empezar y un correo de anticipación.
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: ev.avisoMinutos ?? 30 },
        { method: "email", minutes: ev.avisoCorreoMinutos ?? 1440 },
      ],
    },
  };
  // Límite documentado: una cuenta de servicio NO puede invitar asistentes si no
  // tiene delegación de dominio — Google rechaza el evento entero con
  // "Service accounts cannot invite attendees...". Por eso, en esa vía, los
  // involucrados van en la descripción y no como invitados.
  if (ev.invitados?.length && !hayCuentaDeServicio()) {
    cuerpo.attendees = ev.invitados.map((email) => ({ email }));
  }
  // Propiedades privadas: sobreviven a ediciones y permiten reconocer el vínculo
  // tarea ↔ evento sin adivinar por el título. `jpApp` marca todos los eventos
  // nacidos en el tablero, de modo que la vuelta no necesita guardar nada:
  // el vínculo viaja dentro del propio evento.
  cuerpo.extendedProperties = {
    private: {
      jpApp: MARCA_APP,
      ...(ev.idTarea !== undefined ? { jpTarea: String(ev.idTarea) } : {}),
    },
  };

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(c.calendarId)}/events`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "Google rechazó la creación del evento.");
  return { id: data.id as string, link: data.htmlLink as string };
}

export interface EventoLeido {
  idTarea: number;
  idEvento: string;
  titulo: string;
  /** Inicio en ISO, tal como lo tiene el calendario hoy. */
  inicio: string | null;
  /** dd/mm, para comparar con el campo del tablero. */
  fechaCorta: string | null;
  cancelado: boolean;
  /** Ya pasó la hora de fin. */
  ocurrio: boolean;
  link: string | null;
}

export interface EventoSuelto {
  idEvento: string;
  titulo: string;
  descripcion: string;
  inicio: string | null;
  fechaCorta: string | null;
  dias: number | null;
  link: string | null;
}

/**
 * Lee TODA la agenda en una ventana de tiempo y la parte en dos:
 *  · conMarca — eventos nacidos en el tablero (llevan jpApp/jpTarea)
 *  · sueltos  — eventos cargados a mano en Google, que el tablero no conoce
 *
 * Los sueltos son los que antes quedaban invisibles. Ahora se ven y se pueden
 * traer al tablero como tarea.
 */
export async function leerAgenda(desdeDias = 30, hastaDias = 120) {
  const c = configuracion();
  const token = await tokenDeAcceso();
  const ahora = Date.now();
  const p = new URLSearchParams({
    timeMin: new Date(ahora - desdeDias * 86400000).toISOString(),
    timeMax: new Date(ahora + hastaDias * 86400000).toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(c.calendarId)}/events?${p}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "Google rechazó la lectura de la agenda.");

  const dd = (n: number) => String(n).padStart(2, "0");
  const hoy0 = new Date();
  const sueltos: EventoSuelto[] = [];

  for (const it of (data.items ?? []) as {
    id: string; summary?: string; description?: string; htmlLink?: string;
    start?: { dateTime?: string; date?: string };
    extendedProperties?: { private?: Record<string, string> };
  }[]) {
    if (it.extendedProperties?.private?.jpApp === MARCA_APP) continue; // ése ya es nuestro
    const iniStr = it.start?.dateTime ?? it.start?.date ?? null;
    const ini = iniStr ? new Date(iniStr) : null;
    sueltos.push({
      idEvento: it.id,
      titulo: it.summary ?? "(sin título)",
      descripcion: (it.description ?? "").slice(0, 300),
      inicio: iniStr,
      fechaCorta: ini ? `${dd(ini.getDate())}/${dd(ini.getMonth() + 1)}` : null,
      dias: ini
        ? Math.round(
            (new Date(ini.getFullYear(), ini.getMonth(), ini.getDate()).getTime() -
              new Date(hoy0.getFullYear(), hoy0.getMonth(), hoy0.getDate()).getTime()) /
              86400000
          )
        : null,
      link: it.htmlLink ?? null,
    });
  }
  return sueltos;
}

/**
 * Estampa un evento ajeno con el número de tarea. Desde entonces queda
 * emparejado en las dos direcciones y deja de ser "suelto".
 */
export async function vincularEvento(idEvento: string, idTarea: number) {
  const c = configuracion();
  const token = await tokenDeAcceso();
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(c.calendarId)}/events/${encodeURIComponent(idEvento)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        extendedProperties: { private: { jpApp: MARCA_APP, jpTarea: String(idTarea) } },
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "No se pudo vincular el evento.");
  return { id: data.id as string };
}

/**
 * LA VUELTA — lee del calendario los eventos que el tablero creó.
 *
 * No hace falta guardar ningún vínculo de este lado: el evento lleva adentro
 * la marca `jpApp` y el número de tarea. Se pregunta por esa marca y Google
 * devuelve exactamente los suyos.
 *
 * Limitación conocida: sólo ve lo que nació acá. Las reuniones que Jimmy ya
 * tenía cargadas a mano quedan invisibles hasta que exista el emparejamiento.
 */
export async function leerEventosDelTablero(): Promise<EventoLeido[]> {
  const c = configuracion();
  const token = await tokenDeAcceso();
  const p = new URLSearchParams({
    privateExtendedProperty: `jpApp=${MARCA_APP}`,
    showDeleted: "true",
    singleEvents: "true",
    maxResults: "250",
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(c.calendarId)}/events?${p}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "Google rechazó la lectura de eventos.");

  const ahora = Date.now();
  const dd = (n: number) => String(n).padStart(2, "0");

  type ItemGoogle = {
    id: string;
    summary?: string;
    status?: string;
    htmlLink?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    extendedProperties?: { private?: Record<string, string> };
  };

  return ((data.items ?? []) as ItemGoogle[])
    .map((it) => {
      const idTarea = Number(it.extendedProperties?.private?.jpTarea);
      if (!Number.isFinite(idTarea)) return null;
      const inicioStr = it.start?.dateTime ?? it.start?.date ?? null;
      const finStr = it.end?.dateTime ?? it.end?.date ?? inicioStr;
      const inicio = inicioStr ? new Date(inicioStr) : null;
      const fin = finStr ? new Date(finStr) : null;
      return {
        idTarea,
        idEvento: it.id,
        titulo: it.summary ?? "(sin título)",
        inicio: inicioStr,
        fechaCorta: inicio ? `${dd(inicio.getDate())}/${dd(inicio.getMonth() + 1)}` : null,
        cancelado: it.status === "cancelled",
        ocurrio: !!fin && fin.getTime() < ahora && it.status !== "cancelled",
        link: it.htmlLink ?? null,
      } satisfies EventoLeido;
    })
    .filter((x): x is EventoLeido => x !== null);
}

/**
 * CAMINO A — link de Google Calendar prellenado. No usa API ni credenciales:
 * abre el formulario de Google con todo cargado y la persona confirma.
 * Sirve mientras la conexión no esté configurada.
 */
export function linkPrellenado(ev: EventoNuevo): string {
  const inicio = new Date(ev.inicio);
  const fin = new Date(inicio.getTime() + (ev.minutos ?? 60) * 60000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.titulo,
    dates: `${fmt(inicio)}/${fmt(fin)}`,
  });
  if (ev.descripcion) p.set("details", ev.descripcion);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
