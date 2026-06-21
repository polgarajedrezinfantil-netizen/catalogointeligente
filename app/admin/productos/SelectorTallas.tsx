"use client";

import { useState } from "react";
import type { Campo, Producto } from "@/lib/tipos";

// Selector de tallas: desplegable con las tallas existentes + "Otro…" para
// escribir una personalizada. Las elegidas se muestran como chips. Cada talla
// se envía como un input oculto attr_<campoId> (multi-valor).
export function SelectorTallas({
  campo,
  producto,
}: {
  campo: Campo;
  producto?: Producto;
}) {
  const actual = producto?.atributos?.[campo.id];
  const inicial = Array.isArray(actual)
    ? (actual as string[])
    : actual
      ? [String(actual)]
      : [];
  const [sel, setSel] = useState<string[]>(inicial);
  const [modoOtro, setModoOtro] = useState(false);
  const [otro, setOtro] = useState("");

  const disponibles = campo.opciones.filter((o) => !sel.includes(o));

  function agregar(valor: string) {
    const v = valor.trim();
    if (!v || sel.includes(v)) return;
    setSel([...sel, v]);
  }

  return (
    <div className="block">
      <span className="text-sm font-semibold text-cacao">
        {campo.nombre}
        {campo.obligatorio && <span className="text-durazno"> *</span>}
      </span>

      {/* Chips seleccionados */}
      {sel.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {sel.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full bg-verde-mielina/20 px-2 py-0.5 text-sm font-semibold text-[#3f5a1c]"
            >
              {t}
              <button
                type="button"
                onClick={() => setSel(sel.filter((x) => x !== t))}
                aria-label={`Quitar ${t}`}
                className="text-cacao"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Desplegable para agregar */}
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <select
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__otro__") setModoOtro(true);
            else if (v) agregar(v);
            e.target.value = "";
          }}
          className="rounded-xl border border-miel-borde bg-crema px-3 py-2 text-sm"
        >
          <option value="">+ Agregar talla…</option>
          {disponibles.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          <option value="__otro__">✏️ Otro (personalizada)…</option>
        </select>

        {modoOtro && (
          <span className="flex items-center gap-1">
            <input
              value={otro}
              onChange={(e) => setOtro(e.target.value)}
              placeholder="Ej. 8 años / XL"
              className="w-32 rounded-xl border border-miel-borde bg-crema px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                agregar(otro);
                setOtro("");
                setModoOtro(false);
              }}
              className="rounded-full bg-verde-mielina px-3 py-1.5 text-sm font-bold text-white"
            >
              Agregar
            </button>
          </span>
        )}
      </div>

      {/* Valores enviados al guardar */}
      {sel.map((t) => (
        <input key={t} type="hidden" name={`attr_${campo.id}`} value={t} />
      ))}
    </div>
  );
}
