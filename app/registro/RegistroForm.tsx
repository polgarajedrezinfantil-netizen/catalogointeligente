"use client";

import { useActionState } from "react";
import { registrarTienda, type EstadoRegistro } from "./actions";

// Formulario de alta self-service (cliente): tienda + cuenta en un paso.
export function RegistroForm() {
  const [estado, action, pendiente] = useActionState<EstadoRegistro, FormData>(
    registrarTienda,
    null,
  );

  const campo =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 outline-none transition focus:border-indigo-500";

  return (
    <form action={action} className="flex w-full flex-col gap-3">
      {/* Honeypot: oculto para humanos; los bots lo rellenan. */}
      <input
        type="text"
        name="web"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <label className="text-sm font-semibold text-slate-700">
        Nombre de tu tienda
        <input
          name="tienda"
          required
          placeholder="Ej. Maquillaje Lupita"
          className={`mt-1 ${campo}`}
        />
      </label>
      <label className="text-sm font-semibold text-slate-700">
        Tu nombre
        <input name="nombre" required placeholder="Ej. Lupita García" className={`mt-1 ${campo}`} />
      </label>
      <label className="text-sm font-semibold text-slate-700">
        Correo
        <input
          name="email"
          type="email"
          required
          placeholder="tucorreo@ejemplo.com"
          className={`mt-1 ${campo}`}
        />
      </label>
      <label className="text-sm font-semibold text-slate-700">
        Contraseña
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="Mínimo 8 caracteres"
          className={`mt-1 ${campo}`}
        />
      </label>

      <button
        disabled={pendiente}
        className="mt-2 rounded-full bg-indigo-600 px-6 py-3 font-bold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
      >
        {pendiente ? "Creando tu tienda…" : "Crear mi tienda gratis"}
      </button>

      {estado && (
        <p
          className={`rounded-xl px-3 py-2 text-sm ${
            estado.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
          }`}
        >
          {estado.mensaje}
        </p>
      )}
    </form>
  );
}
