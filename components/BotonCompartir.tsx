"use client";

import { useState } from "react";

type Props = {
  url: string; // ruta (/p/<id>) o URL completa
  titulo: string;
  texto: string;
  label?: string;
  className?: string;
};

// Botón Compartir: usa el menú nativo del celular (navigator.share) y, si no
// existe, abre WhatsApp con el enlace; siempre permite copiar el enlace.
export function BotonCompartir({ url, titulo, texto, label = "Compartir", className }: Props) {
  const [copiado, setCopiado] = useState(false);

  function urlCompleta() {
    if (url.startsWith("http")) return url;
    if (typeof window !== "undefined") return window.location.origin + url;
    return url;
  }

  async function compartir() {
    const full = urlCompleta();
    // Menú nativo (móvil): WhatsApp, Instagram, etc.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: titulo, text: texto, url: full });
        return;
      } catch {
        return; // el usuario canceló el menú
      }
    }
    // Sin menú nativo (escritorio): abre WhatsApp Web.
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${texto} ${full}`)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(urlCompleta());
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {}
  }

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <button
        onClick={compartir}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-sol py-2.5 text-center font-producto font-bold text-[#7a5414]"
      >
        📤 {label}
      </button>
      <button
        onClick={copiar}
        aria-label="Copiar enlace"
        className="rounded-full border border-miel-borde bg-white px-3 py-2.5 text-sm font-semibold text-cacao"
      >
        {copiado ? "¡Copiado!" : "🔗"}
      </button>
    </div>
  );
}
