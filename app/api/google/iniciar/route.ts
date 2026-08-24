import { NextResponse } from "next/server";
import { loQueFalta, urlDeConsentimiento } from "@/lib/google";

// Manda a Google a pedir el permiso. Se usa UNA sola vez: de la vuelta sale el
// refresh token, que se guarda como variable de entorno y ya no se repite.
export async function GET() {
  const falta = loQueFalta();
  if (falta.length > 0) {
    return new NextResponse(
      pagina(
        "Falta configurar la conexión",
        `<p>Todavía no están estas variables de entorno:</p>
         <pre>${falta.join("\n")}</pre>
         <p>Ponelas en <code>.env.local</code> (y en Vercel para producción) y reiniciá el servidor.</p>`
      ),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
  return NextResponse.redirect(urlDeConsentimiento());
}

function pagina(titulo: string, cuerpo: string) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
  <title>${titulo}</title>
  <style>
    body{font-family:system-ui,sans-serif;background:#0b1020;color:#e6ebff;
         display:grid;place-items:center;min-height:100vh;margin:0;padding:24px}
    .caja{max-width:640px;background:#151b33;border-radius:20px;padding:28px;
          box-shadow:0 20px 60px rgba(0,0,0,.4)}
    h1{margin:0 0 12px;font-size:20px}
    pre{background:#0b1020;padding:14px;border-radius:12px;overflow:auto;
        color:#8ea2ff;font-size:13px;user-select:all}
    code{background:#0b1020;padding:2px 6px;border-radius:6px}
    a{color:#8ea2ff}
  </style></head><body><div class="caja"><h1>${titulo}</h1>${cuerpo}</div></body></html>`;
}
