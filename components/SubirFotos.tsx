"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { urlFoto, BUCKET } from "@/lib/fotos";

// Procesa la imagen para celular: máx 1200px, JPEG 0.82.
// Usa <img>+canvas (compatible con iOS/Safari, decodifica HEIC). Si algo
// falla, sube la foto original tal cual (no se pierde la imagen).
async function procesar(
  file: File,
): Promise<{ blob: Blob; contentType: string; ext: string }> {
  try {
    const jpeg = await new Promise<Blob>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        const maxW = 1200;
        const escala = Math.min(1, maxW / (img.naturalWidth || img.width));
        const w = Math.round((img.naturalWidth || img.width) * escala);
        const h = Math.round((img.naturalHeight || img.height) * escala);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          return reject(new Error("sin canvas"));
        }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (b) => {
            URL.revokeObjectURL(url);
            b ? resolve(b) : reject(new Error("sin blob"));
          },
          "image/jpeg",
          0.82,
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("no se pudo leer la imagen"));
      };
      img.src = url;
    });
    return { blob: jpeg, contentType: "image/jpeg", ext: "jpg" };
  } catch {
    // Respaldo: subir el archivo original sin procesar.
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    return { blob: file, contentType: file.type || "image/jpeg", ext };
  }
}

type Props = {
  name: string; // nombre del input oculto que leerá el server action
  tiendaId: string;
  multiple?: boolean;
  inicial?: string[]; // paths ya guardados (modo edición)
  // Modo controlado: comparte el estado con el padre (para reusar las mismas
  // fotos en varias partes de la pantalla, ej. el módulo de IA).
  paths?: string[];
  onCambio?: (paths: string[]) => void;
};

// Sube una o varias fotos al bucket 'fotos'. Botones separados: "Tomar foto"
// (cámara) y "Subir foto" (galería). Guarda los paths en un input oculto y/o
// avisa al padre por onCambio. Muestra miniaturas.
export function SubirFotos({
  name,
  tiendaId,
  multiple,
  inicial = [],
  paths,
  onCambio,
}: Props) {
  const supabase = createClient();
  const controlado = paths !== undefined && onCambio !== undefined;
  const [internas, setInternas] = useState<string[]>(inicial);
  const lista = controlado ? (paths as string[]) : internas;
  const fijar = (next: string[]) =>
    controlado ? onCambio!(next) : setInternas(next);

  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setSubiendo(true);
    setError(null);
    const nuevos: string[] = [];
    for (const file of files) {
      try {
        const { blob, contentType, ext } = await procesar(file);
        const path = `${tiendaId}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, blob, { contentType });
        if (error) throw error;
        nuevos.push(path);
      } catch (err) {
        setError(
          "No se pudo subir la foto: " +
            (err instanceof Error ? err.message : "error desconocido"),
        );
      }
    }
    fijar(multiple ? [...lista, ...nuevos] : nuevos.slice(0, 1));
    setSubiendo(false);
    e.target.value = "";
  }

  function quitar(path: string) {
    fijar(lista.filter((p) => p !== path));
  }

  // Reordena: la primera foto es la "principal".
  function mover(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= lista.length) return;
    const next = [...lista];
    [next[idx], next[j]] = [next[j], next[idx]];
    fijar(next);
  }

  const valor = multiple ? JSON.stringify(lista) : (lista[0] ?? "");

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={valor} readOnly />
      <div className="flex flex-wrap items-start gap-2">
        {lista.map((p, idx) => (
          <div key={p} className="w-20">
            <div className="relative h-20 w-20 overflow-hidden rounded-lg">
              <Image src={urlFoto(p)} alt="foto" fill sizes="80px" className="object-cover" />
              {multiple && idx === 0 && (
                <span className="absolute left-0 top-0 rounded-br-lg bg-verde-mielina px-1 text-[9px] font-bold text-white">
                  Principal
                </span>
              )}
              <button
                type="button"
                onClick={() => quitar(p)}
                className="absolute right-0 top-0 rounded-bl-lg bg-durazno px-1.5 text-xs font-bold text-white"
              >
                ×
              </button>
            </div>
            {multiple && lista.length > 1 && (
              <div className="mt-0.5 flex justify-center gap-1">
                <button
                  type="button"
                  onClick={() => mover(idx, -1)}
                  disabled={idx === 0}
                  aria-label="Mover antes"
                  className="rounded border border-miel-borde px-1.5 text-xs disabled:opacity-30"
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={() => mover(idx, 1)}
                  disabled={idx === lista.length - 1}
                  aria-label="Mover después"
                  className="rounded border border-miel-borde px-1.5 text-xs disabled:opacity-30"
                >
                  ▶
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Dos opciones: tomar foto (cámara) o subir desde la galería */}
      <div className="flex flex-wrap gap-2">
        <label className="cursor-pointer rounded-full bg-verde-mielina px-3 py-1.5 text-sm font-bold text-white">
          📷 Tomar foto
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple={multiple}
            onChange={alElegir}
            className="hidden"
          />
        </label>
        <label className="cursor-pointer rounded-full border border-miel-borde bg-white px-3 py-1.5 text-sm font-semibold text-texto">
          🖼️ Subir foto
          <input
            type="file"
            accept="image/*"
            multiple={multiple}
            onChange={alElegir}
            className="hidden"
          />
        </label>
        {subiendo && <span className="self-center text-xs text-cacao">Subiendo…</span>}
      </div>
      {error && <p className="text-xs text-durazno">{error}</p>}
    </div>
  );
}
