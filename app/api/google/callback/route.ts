import { canjearCodigo } from "@/lib/google";

// Vuelta de Google. Canjea el código y MUESTRA el refresh token en pantalla
// para que lo pegues en las variables de entorno.
//
// Por qué se muestra y no se guarda solo: guardarlo requeriría una base de
// datos o escribir en disco (que en Vercel no persiste). Como se hace una única
// vez en la vida de la app, es más honesto mostrarlo y que vos lo custodies.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const codigo = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return html(
      "Google devolvió un error",
      `<p>Respuesta: <code>${escapar(error)}</code></p>
       <p>Si dice <code>access_denied</code>, es que no se aceptó el permiso.
          Si dice <code>redirect_uri_mismatch</code>, la URL de retorno cargada en
          la consola de Google no coincide con <code>GOOGLE_REDIRECT_URI</code>.</p>`,
      400
    );
  }
  if (!codigo) {
    return html("Falta el código", "<p>Google no mandó el parámetro <code>code</code>.</p>", 400);
  }

  try {
    const tokens = await canjearCodigo(codigo);
    if (!tokens.refresh_token) {
      return html(
        "Autorizó, pero no vino el refresh token",
        `<p>Pasa cuando ya habías autorizado antes: Google entrega el refresh token
            una sola vez por autorización.</p>
         <p>Solución: entrá a
            <a href="https://myaccount.google.com/permissions" target="_blank">los permisos de tu cuenta</a>,
            quitá el acceso a esta app, y volvé a empezar desde
            <code>/api/google/iniciar</code>.</p>`,
        400
      );
    }
    return html(
      "Listo — copiá esto",
      `<p>Pegá esta línea en tu <code>.env.local</code> y en las variables de entorno de Vercel:</p>
       <pre>GOOGLE_REFRESH_TOKEN=${escapar(tokens.refresh_token)}</pre>
       <p><strong>Es una credencial.</strong> No la pegues en un chat ni la subas al repositorio.
          Si se filtra, se revoca desde los permisos de tu cuenta de Google y se genera de nuevo.</p>
       <p>Después reiniciá el servidor y volvé al <a href="/">tablero</a>.</p>`
    );
  } catch (e) {
    return html("No se pudo canjear el código", `<p><code>${escapar(String(e))}</code></p>`, 502);
  }
}

const escapar = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function html(titulo: string, cuerpo: string, estado = 200) {
  return new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8">
    <title>${titulo}</title>
    <style>
      body{font-family:system-ui,sans-serif;background:#0b1020;color:#e6ebff;
           display:grid;place-items:center;min-height:100vh;margin:0;padding:24px}
      .caja{max-width:680px;background:#151b33;border-radius:20px;padding:28px;
            box-shadow:0 20px 60px rgba(0,0,0,.4);line-height:1.6}
      h1{margin:0 0 12px;font-size:20px}
      pre{background:#0b1020;padding:14px;border-radius:12px;overflow:auto;
          color:#8ea2ff;font-size:13px;user-select:all}
      code{background:#0b1020;padding:2px 6px;border-radius:6px}
      a{color:#8ea2ff}
    </style></head><body><div class="caja"><h1>${titulo}</h1>${cuerpo}</div></body></html>`,
    { status: estado, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
