import { NextResponse, type NextRequest } from "next/server";

// Protege todo el planner: sin la cookie de sesión, redirige a /login.
export function middleware(req: NextRequest) {
  const sesion = req.cookies.get("jp_sesion")?.value;
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
