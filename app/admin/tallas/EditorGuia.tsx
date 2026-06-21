"use client";

import { useActionState, useEffect, useState } from "react";
import type { GuiaTallas, Linea } from "@/lib/tipos";
import { guardarGuia, borrarGuia, type EstadoGuia } from "./actions";

const COLS_DEFAULT = ["Talla", "Edad", "Estatura (cm)"];

type Props = {
  lineas: Linea[];
  guia?: GuiaTallas; // edición; ausente = nueva
};

// Editor de una guía de tallas: nombre, línea (o general) y una tabla simple
// con columnas y filas que el admin agrega/quita.
export function EditorGuia({ lineas, guia }: Props) {
  const [estado, action, pendiente] = useActionState<EstadoGuia, FormData>(guardarGuia, null);

  const [nombre, setNombre] = useState(guia?.nombre ?? "");
  const [lineaId, setLineaId] = useState(guia?.linea_id ?? "");
  const [columnas, setColumnas] = useState<string[]>(guia?.columnas?.length ? guia.columnas : COLS_DEFAULT);
  const [filas, setFilas] = useState<string[][]>(
    guia?.filas?.length ? guia.filas : [COLS_DEFAULT.map(() => "")],
  );

  const esNueva = !guia;

  // Al crear con éxito, limpia el formulario para la siguiente.
  useEffect(() => {
    if (estado?.ok && esNueva) {
      setNombre("");
      setLineaId("");
      setColumnas(COLS_DEFAULT);
      setFilas([COLS_DEFAULT.map(() => "")]);
    }
  }, [estado, esNueva]);

  function setColumna(i: number, v: string) {
    setColumnas((c) => c.map((x, j) => (j === i ? v : x)));
  }
  function agregarColumna() {
    setColumnas((c) => [...c, ""]);
    setFilas((f) => f.map((row) => [...row, ""]));
  }
  function quitarColumna(i: number) {
    if (columnas.length <= 1) return;
    setColumnas((c) => c.filter((_, j) => j !== i));
    setFilas((f) => f.map((row) => row.filter((_, j) => j !== i)));
  }
  function setCelda(fi: number, ci: number, v: string) {
    setFilas((f) => f.map((row, j) => (j === fi ? row.map((x, k) => (k === ci ? v : x)) : row)));
  }
  function agregarFila() {
    setFilas((f) => [...f, columnas.map(() => "")]);
  }
  function quitarFila(fi: number) {
    setFilas((f) => f.filter((_, j) => j !== fi));
  }

  const payload = JSON.stringify({
    id: guia?.id,
    nombre,
    linea_id: lineaId || null,
    columnas,
    filas,
    activa: true,
  });

  return (
    <form action={action} className="space-y-3 rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
      <input type="hidden" name="payload" value={payload} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold text-cacao">
          Nombre de la guía
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Ropa niña"
            className="mt-1 w-full rounded-xl border border-miel-borde bg-crema px-3 py-2 outline-none focus:border-verde-mielina"
          />
        </label>
        <label className="text-sm font-semibold text-cacao">
          ¿Para qué línea?
          <select
            value={lineaId}
            onChange={(e) => setLineaId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-miel-borde bg-crema px-3 py-2 outline-none focus:border-verde-mielina"
          >
            <option value="">— General (todas) —</option>
            {lineas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.icono} {l.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Tabla editable */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {columnas.map((c, i) => (
                <th key={i} className="p-1">
                  <div className="flex items-center gap-1">
                    <input
                      value={c}
                      onChange={(e) => setColumna(i, e.target.value)}
                      placeholder="Columna"
                      className="w-28 rounded-lg border border-miel-borde bg-miel/20 px-2 py-1 text-xs font-bold text-texto outline-none"
                    />
                    {columnas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => quitarColumna(i)}
                        title="Quitar columna"
                        className="text-xs text-durazno"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th className="p-1">
                <button
                  type="button"
                  onClick={agregarColumna}
                  className="rounded-full border border-miel-borde px-2 py-1 text-xs font-semibold text-cacao"
                >
                  + Columna
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.map((row, fi) => (
              <tr key={fi}>
                {columnas.map((_, ci) => (
                  <td key={ci} className="p-1">
                    <input
                      value={row[ci] ?? ""}
                      onChange={(e) => setCelda(fi, ci, e.target.value)}
                      className="w-28 rounded-lg border border-miel-borde bg-crema px-2 py-1 text-xs outline-none focus:border-verde-mielina"
                    />
                  </td>
                ))}
                <td className="p-1">
                  <button
                    type="button"
                    onClick={() => quitarFila(fi)}
                    title="Quitar fila"
                    className="text-xs text-durazno"
                  >
                    ✕ fila
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={agregarFila}
        className="rounded-full border border-miel-borde px-3 py-1.5 text-xs font-semibold text-cacao"
      >
        + Agregar fila
      </button>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          disabled={pendiente}
          className="rounded-full bg-verde-mielina px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {pendiente ? "Guardando…" : guia ? "Guardar cambios" : "Crear guía"}
        </button>
        {guia && (
          <button
            formAction={borrarGuia}
            name="guia_id"
            value={guia.id}
            onClick={(e) => {
              if (!confirm(`¿Eliminar la guía “${guia.nombre}”?`)) e.preventDefault();
            }}
            className="rounded-full border border-durazno px-4 py-2 text-sm font-bold text-durazno"
          >
            🗑️ Eliminar
          </button>
        )}
        {estado && (
          <span className={`text-sm ${estado.ok ? "text-[#3f5a1c]" : "text-durazno"}`}>
            {estado.mensaje}
          </span>
        )}
      </div>
    </form>
  );
}
