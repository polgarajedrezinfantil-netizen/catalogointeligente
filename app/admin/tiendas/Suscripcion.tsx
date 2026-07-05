"use client";

import { useActionState } from "react";
import {
  extenderMes,
  gestionarSuscripcion,
  type EstadoInvitacion,
} from "./actions";

type Props = {
  tiendaId: string;
  precio: number;
  estado: {
    tipo: "cortesia" | "trial" | "pagada" | "vencida";
    vence: string | null; // fecha legible ya formateada en el server
    diasRestantes: number | null;
  };
  initPoint: string | null;
  emailSugerido: string;
};

const CHIP: Record<Props["estado"]["tipo"], { texto: string; clase: string }> = {
  cortesia: { texto: "cortesía", clase: "bg-slate-200 text-slate-600" },
  trial: { texto: "prueba", clase: "bg-amber-200 text-amber-900" },
  pagada: { texto: "pagada", clase: "bg-verde-mielina/30 text-[#3f5a1c]" },
  vencida: { texto: "vencida", clase: "bg-red-200 text-red-800" },
};

// Bloque de suscripción de una tienda en el panel del superadmin: estado,
// link de cobro de MP y registro de pago manual.
export function Suscripcion({ tiendaId, precio, estado, initPoint, emailSugerido }: Props) {
  const [resultado, action, pendiente] = useActionState<EstadoInvitacion, FormData>(
    gestionarSuscripcion,
    null,
  );
  const chip = CHIP[estado.tipo];

  return (
    <div className="mt-3 border-t border-miel-borde pt-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-cacao">Suscripción</span>
        <span className={`rounded-full px-2 py-0.5 text-xs ${chip.clase}`}>{chip.texto}</span>
        {estado.tipo === "trial" && estado.diasRestantes != null && (
          <span className="text-xs text-cacao">quedan {estado.diasRestantes} días de prueba</span>
        )}
        {estado.tipo === "pagada" && estado.vence && (
          <span className="text-xs text-cacao">pagada hasta {estado.vence}</span>
        )}
        {estado.tipo === "vencida" && estado.vence && (
          <span className="text-xs text-red-700">venció el {estado.vence}</span>
        )}
        <span className="ml-auto text-xs text-cacao">
          ${precio} <span className="opacity-70">MXN/mes</span>
        </span>
      </div>

      {initPoint && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <a
            href={initPoint}
            target="_blank"
            rel="noopener noreferrer"
            className="max-w-full truncate rounded-lg bg-crema px-2 py-1 text-cacao underline"
          >
            {initPoint}
          </a>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(initPoint)}
            className="rounded-full border border-miel-borde px-2 py-1 font-semibold"
          >
            Copiar link
          </button>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-end gap-2">
        <form action={action} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="tienda_id" value={tiendaId} />
          <input
            name="email"
            type="email"
            required
            defaultValue={emailSugerido}
            placeholder="correo del dueño (su MP)"
            className="rounded-lg border border-miel-borde bg-crema px-2 py-1 text-sm"
          />
          <button
            disabled={pendiente}
            className="rounded-full border border-miel-borde px-3 py-1 text-sm font-semibold disabled:opacity-60"
          >
            {pendiente ? "…" : initPoint ? "Regenerar link de cobro" : "Generar link de cobro"}
          </button>
        </form>
        <form action={extenderMes}>
          <input type="hidden" name="tienda_id" value={tiendaId} />
          <button className="rounded-full border border-miel-borde px-3 py-1 text-sm font-semibold">
            Registrar 1 mes pagado
          </button>
        </form>
      </div>

      {resultado && (
        <p
          className={`mt-2 break-all rounded-lg px-3 py-2 text-sm ${
            resultado.ok
              ? "bg-verde-mielina/20 text-[#3f5a1c]"
              : "bg-durazno/20 text-[#7a3a26]"
          }`}
        >
          {resultado.mensaje}
        </p>
      )}
    </div>
  );
}
