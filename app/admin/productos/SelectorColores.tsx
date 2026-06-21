"use client";

import { useState } from "react";
import { COLORES } from "@/lib/colores";
import type { Campo, Producto } from "@/lib/tipos";

// Selector de colores: paleta de swatches con NOMBRE. El admin toca los colores
// de la prenda (varios); el cliente verá el nombre + puntito. "Otro" permite un
// color con nombre personalizado. Cada color se envía como attr_<campoId>.
export function SelectorColores({
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
  const [otro, setOtro] = useState("");

  function toggle(nombre: string) {
    setSel((s) => (s.includes(nombre) ? s.filter((x) => x !== nombre) : [...s, nombre]));
  }
  function agregarOtro() {
    const v = otro.trim();
    if (!v || sel.includes(v)) return;
    setSel([...sel, v]);
    setOtro("");
  }

  // Colores seleccionados que no están en la paleta (personalizados).
  const extra = sel.filter((s) => !COLORES.some((c) => c.nombre === s));

  return (
    <div className="block sm:col-span-2">
      <span className="text-sm font-semibold text-cacao">
        {campo.nombre}
        {campo.obligatorio && <span className="text-durazno"> *</span>}
      </span>

      {/* Paleta */}
      <div className="mt-1.5 flex flex-wrap gap-2">
        {COLORES.map((c) => {
          const activo = sel.includes(c.nombre);
          return (
            <button
              key={c.nombre}
              type="button"
              onClick={() => toggle(c.nombre)}
              className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-semibold ${
                activo
                  ? "border-verde-mielina bg-verde-mielina/15 text-[#3f5a1c]"
                  : "border-miel-borde bg-white text-texto"
              }`}
            >
              <span
                className="h-4 w-4 shrink-0 rounded-full border border-black/10"
                style={{ background: c.hex }}
              />
              {c.nombre}
              {activo && <span>✓</span>}
            </button>
          );
        })}
      </div>

      {/* Colores personalizados elegidos */}
      {extra.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {extra.map((n) => (
            <span
              key={n}
              className="inline-flex items-center gap-1 rounded-full bg-verde-mielina/20 px-2 py-0.5 text-sm font-semibold text-[#3f5a1c]"
            >
              {n}
              <button type="button" onClick={() => toggle(n)} aria-label={`Quitar ${n}`} className="text-cacao">
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Otro color con nombre */}
      <div className="mt-2 flex items-center gap-2">
        <input
          value={otro}
          onChange={(e) => setOtro(e.target.value)}
          placeholder="Otro color (ej. Vino, Menta)…"
          className="w-44 rounded-xl border border-miel-borde bg-crema px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={agregarOtro}
          className="rounded-full bg-verde-mielina px-3 py-1.5 text-sm font-bold text-white"
        >
          Agregar
        </button>
      </div>

      {sel.map((n) => (
        <input key={n} type="hidden" name={`attr_${campo.id}`} value={n} />
      ))}
    </div>
  );
}
