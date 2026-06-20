"use client";

import { useActionState } from "react";
import {
  restablecerPassword,
  eliminarUsuario,
  type EstadoInvitacion,
} from "./actions";

type Usuario = { id: string; nombre: string; rol: string; email: string };

// Lista del equipo de una tienda con acciones de superadmin:
// restablecer contraseña (muestra una temporal) y eliminar la cuenta.
export function GestionUsuarios({ usuarios }: { usuarios: Usuario[] }) {
  if (usuarios.length === 0) {
    return <p className="mt-3 text-xs text-cacao">Sin usuarios todavía.</p>;
  }
  return (
    <div className="mt-3 space-y-2 border-t border-miel-borde pt-3">
      <p className="text-xs font-semibold text-cacao">Usuarios</p>
      {usuarios.map((u) => (
        <FilaUsuario key={u.id} u={u} />
      ))}
    </div>
  );
}

function FilaUsuario({ u }: { u: Usuario }) {
  const [estado, reset, pendiente] = useActionState<EstadoInvitacion, FormData>(
    restablecerPassword,
    null,
  );

  return (
    <div className="rounded-lg bg-crema px-3 py-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-texto">{u.nombre}</span>
        <span className="rounded-full bg-miel px-2 py-0.5 text-xs text-[#7a5a14]">
          {u.rol}
        </span>
        {u.email && <span className="text-xs text-cacao">{u.email}</span>}

        <div className="ml-auto flex gap-2">
          <form action={reset}>
            <input type="hidden" name="user_id" value={u.id} />
            <button
              disabled={pendiente}
              className="rounded-full border border-miel-borde bg-white px-3 py-1 text-xs font-semibold disabled:opacity-60"
            >
              {pendiente ? "…" : "Restablecer contraseña"}
            </button>
          </form>
          <form action={eliminarUsuario}>
            <input type="hidden" name="user_id" value={u.id} />
            <button
              onClick={(e) => {
                if (!confirm(`¿Eliminar la cuenta de ${u.nombre}?`))
                  e.preventDefault();
              }}
              className="rounded-full border border-durazno px-3 py-1 text-xs font-semibold text-durazno"
            >
              Eliminar
            </button>
          </form>
        </div>
      </div>

      {estado && (
        <p
          className={`mt-2 rounded px-2 py-1 text-xs ${
            estado.ok
              ? "bg-verde-mielina/20 font-semibold text-[#3f5a1c]"
              : "bg-durazno/20 text-[#7a3a26]"
          }`}
        >
          {estado.mensaje}
        </p>
      )}
    </div>
  );
}
