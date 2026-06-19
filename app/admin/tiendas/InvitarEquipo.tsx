"use client";

import { useActionState } from "react";
import { gestionarInvitacion, type EstadoInvitacion } from "./actions";

// Alta de admin/delegado de una tienda: contraseña temporal o correo.
export function InvitarEquipo({ tiendaId }: { tiendaId: string }) {
  const [estado, action, pendiente] = useActionState<
    EstadoInvitacion,
    FormData
  >(gestionarInvitacion, null);

  return (
    <div className="mt-3 border-t border-miel-borde pt-3">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="tienda_id" value={tiendaId} />
        <input
          name="nombre"
          placeholder="Nombre"
          className="rounded-lg border border-miel-borde bg-crema px-2 py-1 text-sm"
        />
        <input
          name="email"
          type="email"
          required
          placeholder="correo@ejemplo.com"
          className="rounded-lg border border-miel-borde bg-crema px-2 py-1 text-sm"
        />
        <select
          name="rol"
          defaultValue="admin"
          className="rounded-lg border border-miel-borde bg-crema px-2 py-1 text-sm"
        >
          <option value="admin">admin</option>
          <option value="delegado">delegado</option>
        </select>
        <select
          name="modo"
          defaultValue="password"
          className="rounded-lg border border-miel-borde bg-crema px-2 py-1 text-sm"
        >
          <option value="password">Contraseña temporal</option>
          <option value="correo">Invitar por correo</option>
        </select>
        <button
          disabled={pendiente}
          className="rounded-full bg-durazno px-3 py-1 text-sm font-bold text-white disabled:opacity-60"
        >
          {pendiente ? "…" : "Dar de alta"}
        </button>
      </form>

      {estado && (
        <p
          className={`mt-2 rounded-lg px-3 py-2 text-sm ${
            estado.ok
              ? "bg-verde-mielina/20 text-[#3f5a1c]"
              : "bg-durazno/20 text-[#7a3a26]"
          }`}
        >
          {estado.mensaje}
        </p>
      )}
    </div>
  );
}
