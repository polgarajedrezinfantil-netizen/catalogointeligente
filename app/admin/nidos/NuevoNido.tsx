"use client";

import { useActionState } from "react";
import { SubirFotos } from "@/components/SubirFotos";
import { crearNido, type EstadoNido } from "./actions";

// Alta de un Nido con foto de portada real.
export function NuevoNido({ tiendaId }: { tiendaId: string }) {
  const [estado, action, pendiente] = useActionState<EstadoNido, FormData>(
    crearNido,
    null,
  );
  return (
    <form
      action={action}
      className="grid gap-3 rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4 sm:grid-cols-2"
    >
      <label className="text-sm font-semibold text-cacao">
        Nombre del Nido
        <input
          name="nombre"
          required
          placeholder="Ej. Verano 2026"
          className="mt-1 w-full rounded-xl border border-miel-borde bg-crema px-3 py-2"
        />
      </label>
      <label className="text-sm font-semibold text-cacao">
        Fecha
        <input
          name="fecha"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="mt-1 w-full rounded-xl border border-miel-borde bg-crema px-3 py-2"
        />
      </label>
      <div className="sm:col-span-2">
        <span className="text-sm font-semibold text-cacao">Foto de portada</span>
        <div className="mt-1">
          <SubirFotos name="foto_portada_url" tiendaId={tiendaId} />
        </div>
      </div>
      <div className="sm:col-span-2 flex items-center gap-3">
        <button
          disabled={pendiente}
          className="rounded-full bg-verde-mielina px-6 py-2 font-bold text-white disabled:opacity-60"
        >
          {pendiente ? "Creando…" : "Crear Nido"}
        </button>
        {estado && (
          <span
            className={`text-sm ${estado.ok ? "text-[#3f5a1c]" : "text-durazno"}`}
          >
            {estado.mensaje}
          </span>
        )}
      </div>
    </form>
  );
}
