"use client";

import { useEffect, useState } from "react";

// Barra de navegación inferior fija, estilo Instagram (mobile-first).
// Vive dentro del marco de teléfono (max-w-[460px]).
// El botón de carrito 🛒 abre el carrito (lo maneja CatalogoCliente) y muestra
// cuántos productos tiene apartados el cliente (vía eventos del navegador).
export function BarraInferior({ whatsapp }: { whatsapp: string | null }) {
  const [conteo, setConteo] = useState(0);

  useEffect(() => {
    const onConteo = (e: Event) => setConteo((e as CustomEvent<number>).detail ?? 0);
    window.addEventListener("carrito-conteo", onConteo);
    // Pide el conteo actual por si el catálogo ya estaba montado.
    window.dispatchEvent(new CustomEvent("pedir-conteo"));
    return () => window.removeEventListener("carrito-conteo", onConteo);
  }, []);

  function irArriba() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function irABuscar() {
    window.dispatchEvent(new CustomEvent("abrir-buscador"));
    document.getElementById("buscador")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function abrirCarrito() {
    window.dispatchEvent(new CustomEvent("abrir-carrito"));
  }
  const wa = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, "")}` : null;

  return (
    <nav className="fixed bottom-0 left-1/2 z-30 flex w-full max-w-[460px] -translate-x-1/2 items-center justify-around border-t border-miel-borde bg-white/95 px-2 py-2 backdrop-blur">
      <button onClick={irArriba} aria-label="Inicio" className="p-2 text-xl">🏠</button>
      <button onClick={irABuscar} aria-label="Buscar" className="p-2 text-xl">🔍</button>
      <button
        onClick={abrirCarrito}
        aria-label="Carrito"
        className="relative p-2 text-xl"
      >
        🛒
        {conteo > 0 && (
          <span className="absolute -right-0.5 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-durazno px-1 text-[11px] font-bold text-white">
            {conteo}
          </span>
        )}
      </button>
      {wa ? (
        <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="p-2 text-xl">💬</a>
      ) : (
        <span className="p-2 text-xl opacity-40">💬</span>
      )}
    </nav>
  );
}
