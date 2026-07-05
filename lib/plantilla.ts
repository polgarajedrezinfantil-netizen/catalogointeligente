// Plantilla de storefront por tienda. La marca (colores/logo/textos) es
// configurable por el cliente en /admin/apariencia; la PLANTILLA es la
// estructura visual (hero, tipografías, secciones) y es más profunda: se
// activa por slug aquí, no desde el panel. Así una tienda puede tener un
// diseño distinto sin tocar el resto ni requerir migración de BD.
//
// NO guardar esto en `tiendas.tema`: guardarApariencia valida cada clave del
// tema con regex de color (#RRGGBB) y corrompería cualquier clave no-color.

export type Plantilla = "default" | "boutique";

// slug -> plantilla. Ausente = "default" (el diseño de Mamielina).
const PLANTILLAS: Record<string, Plantilla> = {
  gabrielle: "boutique",
};

export function plantillaDe(slug: string): Plantilla {
  return PLANTILLAS[slug] ?? "default";
}

// Clase que se aplica al contenedor del storefront para re-tematizar fuentes
// (y estilos de plantilla) SOLO dentro de esa tienda. Mapea a globals.css.
export function clasePlantilla(p: Plantilla): string {
  return p === "boutique" ? "plantilla-boutique" : "";
}

// Título "editorial" de una colección cuando difiere del nombre corto de la
// línea (el chip usa el corto; la tarjeta de Colecciones luce el largo).
const TITULOS_COLECCION: Record<string, Record<string, string>> = {
  gabrielle: {
    Efectos: "Efectos & Cromo",
    Tips: "Tips & Puntas",
  },
};

export function tituloColeccion(slug: string, nombreLinea: string): string {
  return TITULOS_COLECCION[slug]?.[nombreLinea] ?? nombreLinea;
}
