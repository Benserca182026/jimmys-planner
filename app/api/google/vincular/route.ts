import { NextResponse } from "next/server";
import { vincularEvento } from "@/lib/google";

// Empareja un evento que ya existía en el calendario con una tarea del tablero.
// A partir de acá el vínculo viaja dentro del propio evento y deja de hacer
// falta adivinar por el título.
export async function POST(req: Request) {
  const { idEvento, idTarea } = await req.json().catch(() => ({}));
  if (!idEvento || typeof idTarea !== "number") {
    return NextResponse.json(
      { error: "solicitud_invalida", mensaje: "Faltan idEvento o idTarea." },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json(await vincularEvento(idEvento, idTarea));
  } catch (e) {
    return NextResponse.json({ error: "api_error", mensaje: String(e) }, { status: 502 });
  }
}
