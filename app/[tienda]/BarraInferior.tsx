"use client";

import { useEffect, useState } from "react";

// Barra de navegación inferior fija, estilo Instagram (mobile-first).
// Vive dentro del marco de teléfono (max-w-[460px]).
// El botón de carrito 🛒 abre el carrito (lo maneja CatalogoCliente) y muestra
// cuántos productos tiene apartados el cliente (vía eventos del navegador).
// En la plantilla boutique usa iconos de línea con etiqueta (como el mockup).
export function BarraInferior({ whatsapp, boutique = false }: { whatsapp: string | null; boutique?: boolean }) {
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

  if (boutique) {
    const btn = "flex flex-col items-center gap-0.5 px-4 py-1 text-[10px] font-medium";
    const badge = conteo > 0 && (
      <span className="absolute -right-1 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[9px] font-bold text-white">
        {conteo}
      </span>
    );
    return (
      <nav className="fixed bottom-0 left-1/2 z-30 flex w-full max-w-[460px] -translate-x-1/2 items-center justify-around border-t border-miel-borde bg-white/95 px-2 py-1.5 backdrop-blur">
        <button onClick={irArriba} aria-label="Inicio" className={`${btn} text-coral`}>
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>
          Inicio
        </button>
        <button onClick={irABuscar} aria-label="Buscar" className={`${btn} text-cacao`}>
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
          Buscar
        </button>
        <button onClick={abrirCarrito} aria-label="Carrito" className={`relative ${btn} text-cacao`}>
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6h15l-1.5 9h-12z" /><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M6 6L5 3H2" /></svg>
          {badge}
          Carrito
        </button>
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className={`${btn} text-cacao`}>
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.2-1.7-.8-2-.9-.3-.1-.5-.2-.7.2-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-1.7-.9-2.9-1.6-4-3.6-.3-.5.3-.5.8-1.6.1-.2 0-.4 0-.5 0-.1-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.2 3.4 5.3 4.7 2 .8 2.7.9 3.7.8.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3M12 2a10 10 0 00-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1012 2z" /></svg>
            Chat
          </a>
        ) : (
          <span className={`${btn} text-cacao opacity-40`}>
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.2-1.7-.8-2-.9-.3-.1-.5-.2-.7.2-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-1.7-.9-2.9-1.6-4-3.6-.3-.5.3-.5.8-1.6.1-.2 0-.4 0-.5 0-.1-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.2 3.4 5.3 4.7 2 .8 2.7.9 3.7.8.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3M12 2a10 10 0 00-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1012 2z" /></svg>
            Chat
          </span>
        )}
      </nav>
    );
  }

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
