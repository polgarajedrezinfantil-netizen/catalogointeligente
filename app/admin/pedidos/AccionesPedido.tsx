"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { cancelarPedido, confirmarPedido, devolverPedido, revertirPago } from "./actions";

// Botón de envío que se bloquea solo mientras corre la acción (evita el
// doble clic que confirmaba dos veces el mismo pedido).
function Enviar({ children, className }: { children: React.ReactNode; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={`${className} disabled:opacity-50`}>
      {pending ? "Un momento…" : children}
    </button>
  );
}

type Accion = "cancelar" | "revertir" | "devolver";

const PANEL: Record<Accion, { titulo: string; aviso: string; boton: string; accion: (fd: FormData) => Promise<void> }> = {
  cancelar: {
    titulo: "Cancelar pedido",
    aviso: "Las prendas vuelven a estar disponibles (o pasan al siguiente de la fila). No se vende nada.",
    boton: "Sí, cancelar",
    accion: cancelarPedido,
  },
  revertir: {
    titulo: "Revertir el pago",
    aviso:
      "El pedido vuelve a Pendiente y las prendas dejan de estar vendidas, pero siguen reservadas para este cliente. Ojo: quien estuviera formado por esas prendas ya no lo está.",
    boton: "Sí, revertir",
    accion: revertirPago,
  },
  devolver: {
    titulo: "Registrar devolución",
    aviso:
      "La venta deja de contar en tus ingresos y las prendas regresan al catálogo. Úsalo cuando el cliente ya te devolvió la mercancía.",
    boton: "Sí, fue devuelto",
    accion: devolverPedido,
  },
};

export function AccionesPedido({
  pedidoId,
  folio,
  estado,
}: {
  pedidoId: string;
  folio: number;
  estado: string;
}) {
  const [abierto, setAbierto] = useState<Accion | null>(null);

  if (estado !== "pendiente" && estado !== "pagado") return null;

  const panel = abierto ? PANEL[abierto] : null;

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {estado === "pendiente" && (
          <>
            <form action={confirmarPedido}>
              <input type="hidden" name="pedido_id" value={pedidoId} />
              <Enviar className="rounded-full bg-verde-mielina px-4 py-2 text-sm font-bold text-white">
                ✓ Confirmar pago (vender)
              </Enviar>
            </form>
            <button
              onClick={() => setAbierto(abierto === "cancelar" ? null : "cancelar")}
              className="rounded-full border border-durazno px-4 py-2 text-sm font-bold text-durazno"
            >
              Cancelar
            </button>
          </>
        )}

        {estado === "pagado" && (
          <>
            <button
              onClick={() => setAbierto(abierto === "revertir" ? null : "revertir")}
              className="rounded-full border border-miel-borde px-4 py-2 text-sm font-semibold text-cacao"
            >
              ↩︎ Revertir pago
            </button>
            <button
              onClick={() => setAbierto(abierto === "devolver" ? null : "devolver")}
              className="rounded-full border border-coral px-4 py-2 text-sm font-semibold text-coral"
            >
              Devolución
            </button>
          </>
        )}
      </div>

      {panel && (
        <form action={panel.accion} className="mt-2 rounded-xl bg-crema/70 p-3">
          <input type="hidden" name="pedido_id" value={pedidoId} />
          <p className="text-sm font-bold text-texto">
            {panel.titulo} #{folio}
          </p>
          <p className="mt-0.5 text-xs text-cacao">{panel.aviso}</p>
          <input
            name="motivo"
            placeholder="Motivo (opcional): ya no lo quiso, no llegó el pago…"
            className="mt-2 w-full rounded-lg border border-miel-borde bg-white px-2 py-1.5 text-sm"
          />
          <div className="mt-2 flex gap-2">
            <Enviar className="rounded-full bg-coral px-3 py-1.5 text-sm font-bold text-white">
              {panel.boton}
            </Enviar>
            <button
              type="button"
              onClick={() => setAbierto(null)}
              className="rounded-full border border-miel-borde px-3 py-1.5 text-sm font-semibold text-cacao"
            >
              Mejor no
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
