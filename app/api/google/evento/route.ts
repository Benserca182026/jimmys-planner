import { NextResponse } from "next/server";
import { configuracion, crearEvento, hayCuentaDeServicio, linkPrellenado } from "@/lib/google";

// Crea el evento de una tarea en el calendario.
// Si la conexión todavía no está configurada, no falla: devuelve el link
// prellenado de Google Calendar (camino A), que funciona sin credenciales.
export async function POST(req: Request) {
  const { titulo, descripcion, inicio, minutos, invitados, idTarea, zonaHoraria } =
    await req.json().catch(() => ({}));

  if (!titulo || !inicio) {
    return NextResponse.json(
      { error: "solicitud_invalida", mensaje: "Faltan el título o la fecha de inicio." },
      { status: 400 }
    );
  }

  const ev = { titulo, descripcion, inicio, minutos, invitados, idTarea, zonaHoraria };
  const c = configuracion();

  // Hay dos vías de autenticación. Si no está ninguna, se cae con elegancia al link.
  const porOAuth = c.clientId && c.clientSecret && c.refreshToken;
  if (!hayCuentaDeServicio() && !porOAuth) {
    return NextResponse.json({
      modo: "link",
      link: linkPrellenado(ev),
      mensaje: "La conexión con la API todavía no está configurada — te dejo el evento prellenado.",
    });
  }

  try {
    const creado = await crearEvento(ev);
    return NextResponse.json({ modo: "api", id: creado.id, link: creado.link });
  } catch (e) {
    // Si la API falla (token revocado, permisos), tampoco se queda sin salida.
    return NextResponse.json({
      modo: "link",
      link: linkPrellenado(ev),
      mensaje: `La API falló (${String(e)}). Te dejo el evento prellenado.`,
    });
  }
}
