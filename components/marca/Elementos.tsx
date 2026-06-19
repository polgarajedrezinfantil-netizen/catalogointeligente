/**
 * Elementos gráficos del brand board de MAMIELINA, como componentes SVG
 * reutilizables: rayas pintadas, marco ondulado, borde de guiones, estrellas,
 * confeti, carita kawaii y píldora de precio. Tono cálido/juguetón.
 */
import type { ReactNode } from "react";

/** Borde ondulado decorativo (marco). */
export function Ondas({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 12" className={className} aria-hidden>
      <path
        d="M2 8 q7 -10 14 0 q7 -10 14 0 q7 -10 14 0 q7 -10 14 0 q7 -10 14 0 q7 -10 14 0 q7 -10 14 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Estrella / destello de marca. */
export function Estrella({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M12 2 l2.4 7 7 2.4 -7 2.4 -2.4 7 -2.4 -7 -7 -2.4 7 -2.4z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Carita kawaii (mielina). */
export function Carita({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <circle cx="24" cy="24" r="18" fill="#F6D9AC" />
      <path
        d="M6 18 q6 -14 18 -12 q12 -2 18 12 q-9 -5 -18 -3 q-9 -2 -18 3z"
        fill="#9C7A52"
      />
      <circle cx="17" cy="25" r="2.6" fill="#3a2f25" />
      <circle cx="31" cy="25" r="2.6" fill="#3a2f25" />
      <circle cx="12" cy="29" r="3.2" fill="#F0B0A0" />
      <circle cx="36" cy="29" r="3.2" fill="#F0B0A0" />
      <path
        d="M19 31 q5 4 10 0"
        fill="none"
        stroke="#3a2f25"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Píldora de precio (estilo brand board). */
export function PildoraPrecio({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-verde-mielina px-3 py-1 font-producto text-sm font-bold text-white ${className}`}
    >
      {children}
    </span>
  );
}

/** Logo tipográfico MA·MIE·LINA en bloques de color. */
export function LogoMamielina({ className = "" }: { className?: string }) {
  const bloque =
    "font-producto font-bold rounded-[14px] px-3 py-0.5 leading-none";
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      <span className={`${bloque} bg-verde-mielina text-[#3f5a1c]`}>MA</span>
      <span className={`${bloque} bg-miel text-[#7a5a14]`}>MIE</span>
      <span className={`${bloque} bg-verde-mielina text-[#3f5a1c]`}>LINA</span>
    </span>
  );
}
