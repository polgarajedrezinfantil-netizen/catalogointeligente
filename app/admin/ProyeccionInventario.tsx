"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { guardarInversion } from "./actions";

type Props = {
  simbolo: string;
  invertidoAuto: number;   // Σ costo × piezas de lo existente
  ventaPotencial: number;  // Σ precio publicado × piezas
  inversionManual: number | null; // null = usar automático
};

// Recuadro de proyección con la inversión EDITABLE. La ganancia estimada se
// recalcula en vivo según lo que la tienda escriba como inversión.
export function ProyeccionInventario({
  simbolo,
  invertidoAuto,
  ventaPotencial,
  inversionManual,
}: Props) {
  const efectivoInicial = inversionManual != null ? inversionManual : invertidoAuto;
  const [valor, setValor] = useState(String(efectivoInicial));

  // Si el servidor revalida con un nuevo valor guardado, sincroniza el input.
  useEffect(() => {
    setValor(String(inversionManual != null ? inversionManual : invertidoAuto));
  }, [inversionManual, invertidoAuto]);

  const invertido = Number(valor) || 0;
  const ganancia = ventaPotencial - invertido;
  const esManual = inversionManual != null;

  return (
    <section className="rounded-[var(--radius-marca)] border border-miel-borde bg-miel/20 p-4 text-sm text-[#7a5a14]">
      <p className="mb-2 font-semibold">Proyección de tu inventario actual</p>

      <form action={guardarInversion} className="space-y-2">
        {/* Invertido (editable) */}
        <div className="flex items-center gap-2">
          <span className="flex-1">
            💰 <strong>Invertido:</strong> lo que te costó la mercancía que aún no vendes.
          </span>
          <div className="flex items-center rounded-xl border border-miel-borde bg-white px-2">
            <span className="text-cacao">{simbolo}</span>
            <input
              name="inversion"
              type="number"
              min={0}
              step="1"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="w-24 bg-transparent py-1.5 text-right font-bold text-texto outline-none"
            />
          </div>
        </div>

        {/* Venta potencial (fija, sale de los precios publicados) */}
        <p>
          🏷️ <strong>Venta potencial:</strong> {simbolo}{ventaPotencial.toFixed(0)} — si vendes todo lo existente al precio publicado.
        </p>

        {/* Ganancia estimada (en vivo) */}
        <p className="rounded-xl bg-white/70 px-3 py-2">
          🍯 <strong>Ganancia estimada:</strong>{" "}
          <span className={ganancia < 0 ? "text-durazno" : "text-[#3f5a1c]"}>
            {simbolo}{ganancia.toFixed(0)}
          </span>{" "}
          — venta potencial menos lo invertido.
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <BotonGuardar />
          <button
            type="submit"
            onClick={() => setValor("")}
            className="rounded-full border border-miel-borde bg-white px-3 py-1.5 text-xs font-semibold text-cacao"
            title={`Cálculo automático: ${simbolo}${invertidoAuto.toFixed(0)}`}
          >
            Usar cálculo automático
          </button>
          <span className="text-xs text-cacao">
            {esManual
              ? `Ajustada a mano · automático: ${simbolo}${invertidoAuto.toFixed(0)}`
              : `Automático (costo × piezas): ${simbolo}${invertidoAuto.toFixed(0)}`}
          </span>
        </div>
      </form>
    </section>
  );
}

function BotonGuardar() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded-full bg-verde-mielina px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60"
    >
      {pending ? "Guardando…" : "Guardar inversión"}
    </button>
  );
}
