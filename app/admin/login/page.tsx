"use client";

import { useActionState, useState } from "react";
import {
  iniciarSesion,
  solicitarRecuperacion,
  type EstadoLogin,
  type EstadoReset,
} from "./actions";

// Login del panel privado. El submit corre una acción de servidor que
// autentica y escribe la cookie de sesión de forma confiable.
// Modo "recuperar": envía un enlace para restablecer la contraseña.
export default function LoginPage() {
  const [modo, setModo] = useState<"login" | "recuperar">("login");

  return (
    <main className="admin-shell flex min-h-screen flex-1 items-center justify-center bg-slate-100 px-6 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <div className="mb-5 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-xs font-black text-white">
              MA
            </span>
            <span className="text-lg font-bold text-slate-800">MyelPlay Agentes</span>
          </div>
          <p className="font-titulo text-durazno">
            {modo === "login" ? "Panel de administración" : "Recuperar contraseña"}
          </p>
        </div>
        {modo === "login" ? (
          <FormularioLogin onRecuperar={() => setModo("recuperar")} />
        ) : (
          <FormularioRecuperar onVolver={() => setModo("login")} />
        )}
      </div>
    </main>
  );
}

function FormularioLogin({ onRecuperar }: { onRecuperar: () => void }) {
  const [estado, accion, cargando] = useActionState<EstadoLogin, FormData>(
    iniciarSesion,
    null,
  );
  const [verPass, setVerPass] = useState(false);

  return (
    <form action={accion} className="space-y-5">
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

      <button
        type="button"
        onClick={onRecuperar}
        className="block w-full text-center text-sm font-semibold text-cacao hover:text-durazno"
      >
        ¿Olvidaste tu contraseña?
      </button>
    </form>
  );
}

function FormularioRecuperar({ onVolver }: { onVolver: () => void }) {
  const [estado, accion, cargando] = useActionState<EstadoReset, FormData>(
    solicitarRecuperacion,
    null,
  );

  return (
    <form action={accion} className="space-y-5">
      <p className="text-sm text-cacao">
        Escribe tu correo y te enviaremos un enlace para crear una contraseña
        nueva.
      </p>

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

      {estado && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            estado.ok
              ? "bg-verde-mielina/20 text-[#3f5a1c]"
              : "bg-durazno/20 text-[#7a3a26]"
          }`}
        >
          {estado.mensaje}
        </p>
      )}

      <button
        type="submit"
        disabled={cargando}
        className="w-full rounded-full bg-verde-mielina py-2.5 font-producto font-bold text-white transition hover:brightness-95 disabled:opacity-60"
      >
        {cargando ? "Enviando…" : "Enviar enlace"}
      </button>

      <button
        type="button"
        onClick={onVolver}
        className="block w-full text-center text-sm font-semibold text-cacao hover:text-durazno"
      >
        ← Volver a iniciar sesión
      </button>
    </form>
  );
}
