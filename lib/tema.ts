// Paleta de marca por tienda. Los tokens se inyectan como variables CSS en
// runtime sobre el contenedor del catálogo; como las utilidades de Tailwind v4
// (bg-verde-mielina, text-cacao…) referencian esas variables, cambiarlas
// re-tematiza todo el catálogo SIN tocar el CSS global ni redeploy.
import type { CSSProperties } from "react";

export type Tema = Record<string, string>;

// Paleta original de Mamielina (respaldo y botón "Restaurar marca").
export const TEMA_DEFAULT: Tema = {
  crema: "#FCF6E8",
  miel: "#F4D58D",
  miel_borde: "#EAD9AE",
  verde_mielina: "#A6C972",
  durazno: "#ECA088",
  sol: "#F4C13E",
  cacao: "#9C8478",
  texto: "#5A4A3F",
  coral: "#E1855F",
};

// token de tema -> variable CSS que usa Tailwind.
const VAR: Record<string, string> = {
  crema: "--color-crema",
  miel: "--color-miel",
  miel_borde: "--color-miel-borde",
  verde_mielina: "--color-verde-mielina",
  durazno: "--color-durazno",
  sol: "--color-sol",
  cacao: "--color-cacao",
  texto: "--color-texto",
  coral: "--color-coral",
};

// Etiquetas en español para el editor (en orden de importancia visual).
export const TOKENS_TEMA: { key: string; label: string }[] = [
  { key: "verde_mielina", label: "Verde (botones y acentos)" },
  { key: "coral", label: "Coral (títulos de sección)" },
  { key: "durazno", label: "Durazno (títulos)" },
  { key: "sol", label: "Sol (precios)" },
  { key: "miel", label: "Miel (fondos suaves)" },
  { key: "crema", label: "Fondo (crema)" },
  { key: "miel_borde", label: "Bordes" },
  { key: "texto", label: "Texto principal" },
  { key: "cacao", label: "Texto suave (cacao)" },
];

// Convierte un tema en el objeto de estilo con las variables CSS.
export function temaStyle(tema?: Tema | null): CSSProperties {
  const t = { ...TEMA_DEFAULT, ...(tema ?? {}) };
  const style: Record<string, string> = {};
  for (const [key, cssVar] of Object.entries(VAR)) {
    if (t[key]) style[cssVar] = t[key];
  }
  return style as CSSProperties;
}
