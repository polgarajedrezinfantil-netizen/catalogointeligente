"use client";

import { useState } from "react";
import Image from "next/image";
import { urlFoto } from "@/lib/fotos";
import { reordenarProductos } from "./actions";

type Item = { id: string; nombre: string; foto: string | null };

// Reordena el catálogo: arrastrar (escritorio) o flechas ↑↓ (móvil).
// "Guardar orden" persiste la posición (la 1ª aparece primero en el catálogo).
export function OrdenarProductos({ inicial }: { inicial: Item[] }) {
  const [items, setItems] = useState(inicial);
  const [drag, setDrag] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);

  function reordenar(desde: number, hasta: number) {
    if (hasta < 0 || hasta >= items.length || desde === hasta) return;
    const next = [...items];
    const [m] = next.splice(desde, 1);
    next.splice(hasta, 0, m);
    setItems(next);
    setOk(false);
  }

  async function guardar() {
    setGuardando(true);
    const fd = new FormData();
    fd.set("ids", JSON.stringify(items.map((i) => i.id)));
    await reordenarProductos(fd);
    setGuardando(false);
    setOk(true);
  }

  return (
    <div>
      <div className="max-h-96 space-y-1 overflow-y-auto rounded-xl border border-miel-borde p-2">
        {items.map((it, idx) => (
          <div
            key={it.id}
            draggable
            onDragStart={() => setDrag(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (drag !== null) reordenar(drag, idx);
              setDrag(null);
            }}
            className={`flex items-center gap-2 rounded-lg bg-crema px-2 py-1.5 ${
              drag === idx ? "opacity-50" : ""
            }`}
          >
            <span className="cursor-grab text-cacao" title="Arrastrar">⠿</span>
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-white">
              {it.foto && (
                <Image src={urlFoto(it.foto)} alt="" fill sizes="40px" className="object-cover" />
              )}
            </div>
            <span className="flex-1 truncate text-sm text-texto">
              <span className="mr-1 text-xs text-cacao">{idx + 1}.</span>
              {it.nombre}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => reordenar(idx, idx - 1)}
                disabled={idx === 0}
                aria-label="Subir"
                className="rounded border border-miel-borde px-1.5 text-sm disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => reordenar(idx, idx + 1)}
                disabled={idx === items.length - 1}
                aria-label="Bajar"
                className="rounded border border-miel-borde px-1.5 text-sm disabled:opacity-30"
              >
                ↓
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="rounded-full bg-verde-mielina px-5 py-2 font-bold text-white disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar orden"}
        </button>
        {ok && <span className="text-sm text-[#3f5a1c]">Orden guardado ✅</span>}
      </div>
    </div>
  );
}
