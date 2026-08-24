// Cliente de Supabase — SÓLO servidor.
//
// El navegador nunca habla con la base. Todo pasa por las rutas del planner,
// que ya están detrás del login. Por eso se usa la clave secreta, que salta las
// reglas de fila (RLS): la autorización la hace la app, no Postgres.
//
// Este archivo no debe importarse nunca desde un componente "use client".

import { createClient } from "@supabase/supabase-js";

export function hayBase(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SECRET_KEY;
}

export function base() {
  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_SECRET_KEY;
  if (!url || !clave) {
    throw new Error("Falta SUPABASE_URL o SUPABASE_SECRET_KEY en el entorno.");
  }
  return createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
