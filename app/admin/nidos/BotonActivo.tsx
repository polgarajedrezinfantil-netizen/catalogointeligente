"use client";

import { useActionState } from "react";
import { alternarActivoNido, type EstadoActivar } from "./actions";

// Botón activar/desactivar Nido que muestra el aviso si se alcanza el
// límite de catálogos del plan.
export function BotonActivo({
  nidoId,
  activo,
}: {
  nidoId: string;
  activo: boolean;
}) {
  const [estado, action, pendiente] = useActionState<EstadoActivar, FormData>(
    alternarActivoNido,
    null,
  );
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <form action={action}>
        <input type="hidden" name="nido_id" value={nidoId} />
        <input type="hidden" name="activo" value={String(activo)} />
        <button
          disabled={pendiente}
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            activo
              ? "bg-verde-mielina/30 text-[#3f5a1c]"
              : "border border-miel-borde text-cacao"
          }`}
        >
          {activo ? "Activo" : "Inactivo"}
        </button>
      </form>
      {estado && !estado.ok && (
        <span className="max-w-[200px] text-xs text-durazno">
          {estado.mensaje}
        </span>
      )}
    </span>
  );
}
