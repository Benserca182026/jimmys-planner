import { NextResponse } from "next/server";

// Credenciales del planner (definidas por el dueño del proyecto).
const USUARIO = "Jimmy";
const CONTRASENA = "Jimmy123";

export async function POST(req: Request) {
  const { usuario, contrasena } = await req.json().catch(() => ({}));
  if (usuario === USUARIO && contrasena === CONTRASENA) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set("jp_sesion", "activa", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 días
      path: "/",
    });
    return res;
  }
  return NextResponse.json(
    { ok: false, error: "Usuario o contraseña incorrectos" },
    { status: 401 }
  );
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("jp_sesion", "", { maxAge: 0, path: "/" });
  return res;
}
