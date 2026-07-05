"use client";

import Image from "next/image";

export type Coleccion = {
  id: string;
  nombre: string;
  icono: string;
  cover: string | null;
};

// Carrusel de "Colecciones" de la plantilla boutique: una tarjeta por línea de
// venta, con la foto de un producto de esa línea como portada. Al tocar una,
// avisa al catálogo (evento) que filtre por esa línea y baja a la cuadrícula.
export function ColeccionesBoutique({ colecciones }: { colecciones: Coleccion[] }) {
  if (colecciones.length === 0) return null;

  function abrir(id: string) {
    window.dispatchEvent(new CustomEvent("seleccionar-linea", { detail: id }));
    document.getElementById("buscador")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="pt-1">
      <div className="flex items-center gap-2 px-1 pb-2.5">
        <span className="text-base" style={{ color: "#C79A6B" }}>👑</span>
        <h2 className="font-titulo text-lg font-semibold text-texto">Colecciones</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {colecciones.map((c) => (
          <button
            key={c.id}
            onClick={() => abrir(c.id)}
            className="relative h-[150px] w-[128px] shrink-0 overflow-hidden rounded-[18px] shadow-sm transition active:scale-95"
          >
            {c.cover ? (
              <Image src={c.cover} alt={c.nombre} fill sizes="128px" className="object-cover" />
            ) : (
              <span className="absolute inset-0 grid place-items-center bg-miel text-3xl">{c.icono}</span>
            )}
            <span className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70" />
            <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[9px] font-bold tracking-wide text-coral">
              Nuevo
            </span>
            <span className="font-titulo absolute inset-x-2.5 bottom-2 text-left text-sm font-semibold leading-tight text-white drop-shadow">
              {c.nombre}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
