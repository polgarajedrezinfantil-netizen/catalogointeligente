"use client";

import { cancelarPedido } from "./actions";

// Botón de cancelar pedido con confirmación nativa (evita accidentes).
export function BotonCancelar({ pedidoId, folio }: { pedidoId: string; folio: number }) {
  return (
    <form action={cancelarPedido}>
      <input type="hidden" name="pedido_id" value={pedidoId} />
      <button
        onClick={(e) => {
          if (!confirm(`¿Cancelar el pedido #${folio}? Las prendas volverán a estar disponibles.`)) {
            e.preventDefault();
          }
        }}
        className="rounded-full border border-durazno px-4 py-2 text-sm font-bold text-durazno"
      >
        Cancelar
      </button>
    </form>
  );
}
