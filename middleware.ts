import { NextResponse, type NextRequest } from "next/server";
import { NOMBRE_COOKIE_SESION, VALOR_SESION } from "@/lib/sesion";

// Protege todo el planner: sin la cookie de sesión VÁLIDA, redirige a /login.
// No basta con que la cookie exista: tiene que traer el token que emite el
// login — una cookie inventada a mano ya no pasa.
export function middleware(req: NextRequest) {
  const sesion = req.cookies.get(NOMBRE_COOKIE_SESION)?.value === VALOR_SESION;
  const esLogin = req.nextUrl.pathname.startsWith("/login");
  const esApiLogin = req.nextUrl.pathname.startsWith("/api/login");

  if (esApiLogin) return NextResponse.next();
  if (!sesion && !esLogin) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (sesion && esLogin) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
