"use client";

import { useActionState, useState } from "react";
import { LogoMamielina } from "@/components/marca/Elementos";
import { iniciarSesion, type EstadoLogin } from "./actions";

// Login del panel privado. El submit corre una acción de servidor que
// autentica y escribe la cookie de sesión de forma confiable.
export default function LoginPage() {
  const [estado, accion, cargando] = useActionState<EstadoLogin, FormData>(
    iniciarSesion,
    null,
  );
  const [verPass, setVerPass] = useState(false);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <form
        action={accion}
        className="w-full max-w-sm space-y-5 rounded-[var(--radius-marca)] border border-miel-borde bg-white p-7 shadow-sm"
      >
        <div className="flex flex-col items-center gap-2">
          <LogoMamielina className="text-xl" />
          <p className="font-titulo text-durazno">Panel de administración</p>
        </div>

        <label className="block text-sm font-semibold text-cacao">
          Correo
          <input
            name="email"
            type="email"
            required
            autoCapitalize="none"
            autoComplete="email"
            className="mt-1 w-full rounded-xl border border-miel-borde bg-crema px-3 py-2 text-texto outline-none focus:border-verde-mielina"
          />
        </label>

        <label className="block text-sm font-semibold text-cacao">
          Contraseña
          <div className="relative mt-1">
            <input
              name="password"
              type={verPass ? "text" : "password"}
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-miel-borde bg-crema px-3 py-2 pr-11 text-texto outline-none focus:border-verde-mielina"
            />
            {/* Ojito dentro del mismo campo */}
            <button
              type="button"
              onClick={() => setVerPass((v) => !v)}
              aria-label={verPass ? "Ocultar contraseña" : "Ver contraseña"}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-lg leading-none"
            >
              {verPass ? "🙈" : "👁️"}
            </button>
          </div>
        </label>

        {estado?.error && <p className="text-sm text-durazno">{estado.error}</p>}

        <button
          type="submit"
          disabled={cargando}
          className="w-full rounded-full bg-verde-mielina py-2.5 font-producto font-bold text-white transition hover:brightness-95 disabled:opacity-60"
        >
          {cargando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
