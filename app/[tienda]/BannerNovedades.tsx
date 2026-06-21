"use client";

import { useEffect, useState } from "react";

type Props = {
  tiendaId: string;
  texto: string | null;
  cupon: string | null;
  porcentaje: number | null;
};

// Banner de novedades arriba del catálogo, con cupón visible para copiar.
// Se puede cerrar; reaparece si la tienda cambia el mensaje o el cupón.
export function BannerNovedades({ tiendaId, texto, cupon, porcentaje }: Props) {
  const clave = `aviso-cerrado-${tiendaId}-${texto ?? ""}-${cupon ?? ""}`;
  const [visible, setVisible] = useState(true);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(clave)) setVisible(false);
  }, [clave]);

  if (!visible || (!texto && !cupon)) return null;

  function cerrar() {
    setVisible(false);
    try {
      sessionStorage.setItem(clave, "1");
    } catch {}
  }

  async function copiar() {
    if (!cupon) return;
    try {
      await navigator.clipboard.writeText(cupon);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {}
  }

  return (
    <div className="relative border-b border-miel-borde bg-gradient-to-r from-sol/30 via-durazno/25 to-coral/25 px-3 py-2.5">
      <button
        onClick={cerrar}
        aria-label="Cerrar aviso"
        className="absolute right-2 top-2 text-xs text-cacao/70"
      >
        ✕
      </button>

      {texto && (
        <p className="pr-5 text-center text-sm font-semibold text-texto">{texto}</p>
      )}

      {cupon && (
        <div className="mt-2 flex items-center justify-center gap-2">
          <span className="rounded-lg border-2 border-dashed border-coral bg-white px-3 py-1 font-producto font-bold tracking-wide text-coral">
            🎟️ {cupon}
            {porcentaje != null && <span className="ml-1 text-[#3f5a1c]">-{porcentaje}%</span>}
          </span>
          <button
            onClick={copiar}
            className="rounded-full bg-verde-mielina px-3 py-1 text-xs font-bold text-white"
          >
            {copiado ? "¡Copiado! 🎉" : "Copiar"}
          </button>
        </div>
      )}
    </div>
  );
}
