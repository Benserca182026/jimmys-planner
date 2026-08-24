import { NextResponse } from "next/server";
import {
  configuracion,
  hayCuentaDeServicio,
  leerAgenda,
  leerEventosDelTablero,
} from "@/lib/google";

// La vuelta: qué dice hoy el calendario de los eventos que creó el tablero.
// Sólo LEE. No modifica ninguna tarea: devuelve los hechos y el tablero decide
// qué hacer con ellos — y sólo cuando la persona aprieta.
export async function GET() {
  const c = configuracion();
  const porOAuth = c.clientId && c.clientSecret && c.refreshToken;
  if (!hayCuentaDeServicio() && !porOAuth) {
    return NextResponse.json(
      {
        error: "sin_conexion",
        mensaje:
          "La conexión con Google no está configurada: falta la cuenta de servicio (GOOGLE_SA_EMAIL + GOOGLE_SA_PRIVATE_KEY) o completar el flujo de OAuth.",
      },
      { status: 400 }
    );
  }
  try {
    const [eventos, sueltos] = await Promise.all([leerEventosDelTablero(), leerAgenda()]);
    return NextResponse.json({ eventos, sueltos });
  } catch (e) {
    return NextResponse.json(
      { error: "api_error", mensaje: String(e) },
      { status: 502 }
    );
  }
}
