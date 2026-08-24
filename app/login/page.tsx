"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PaginaLogin() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCargando(true);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, contrasena }),
    });
    setCargando(false);
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError("Usuario o contraseña incorrectos");
    }
  };

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form
        onSubmit={entrar}
        className="w-full max-w-sm rounded-[28px] bg-white p-8 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)]"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[#e8edff] text-xl">
            📒
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Jimmy&apos;s Planner
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Agenda y pendientes · datos al 17/07
          </p>
        </div>

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-600">Usuario</span>
          <input
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoComplete="username"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none transition focus:border-[#3b5bfd] focus:ring-2 focus:ring-[#3b5bfd]/20"
          />
        </label>
        <label className="mt-4 block text-sm">
          <span className="mb-1.5 block font-medium text-slate-600">
            Contraseña
          </span>
          <input
            type="password"
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none transition focus:border-[#3b5bfd] focus:ring-2 focus:ring-[#3b5bfd]/20"
          />
        </label>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={cargando}
          className="mt-6 w-full rounded-xl bg-[#3b5bfd] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {cargando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
