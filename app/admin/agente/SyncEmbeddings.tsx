"use client";

import { useState } from "react";

// Botón para reindexar el catálogo en la búsqueda vectorial del agente.
// El superadmin debe indicar la tienda (slug); el admin de tienda usa la suya.
export function SyncEmbeddings({ tiendaSlug }: { tiendaSlug?: string }) {
  const [estado, setEstado] = useState<"idle" | "cargando" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function sincronizar() {
    setEstado("cargando");
    setMsg("");
    try {
      const r = await fetch("/api/agente/embeddings/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tiendaSlug ? { tienda: tiendaSlug } : {}),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      setEstado("ok");
      setMsg(
        `Listo: ${data.embebidos} (re)indexados, ${data.sin_cambios} sin cambios, ${data.borrados} retirados.`,
      );
    } catch (e) {
      setEstado("error");
      setMsg(e instanceof Error ? e.message : "Error al indexar");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={sincronizar}
        disabled={estado === "cargando"}
        className="rounded-full bg-durazno px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
      >
        {estado === "cargando" ? "Indexando…" : "🔄 Reindexar catálogo"}
      </button>
      {msg && (
        <span className={`text-sm ${estado === "error" ? "text-coral" : "text-[#3f5a1c]"}`}>
          {msg}
        </span>
      )}
    </div>
  );
}
