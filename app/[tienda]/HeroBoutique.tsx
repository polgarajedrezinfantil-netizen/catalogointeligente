import Image from "next/image";
import type { ComponentType } from "react";

// Acento metálico de la plantilla boutique (dorado). No forma parte del `tema`
// de 9 colores de la tienda: es la firma editorial de esta plantilla.
const ORO = "#B4794F";
const ANILLO_ORO =
  "conic-gradient(from 210deg, #C79A6B, #F6E1C8, #EAD3B4, #B4794F, #C79A6B)";

export type Acceso = {
  href: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
};

// Encabezado tipo "perfil" de la plantilla boutique: avatar con aro dorado,
// nombre en cursiva, subtítulo editorial y accesos en píldoras. Los colores
// (fondo, acentos) salen del tema de la tienda; el dorado es de la plantilla.
export function HeroBoutique({
  marca,
  subtitulo,
  handle,
  tagline,
  logo,
  accesos,
}: {
  marca: string;
  subtitulo?: string | null;
  handle?: string | null;
  tagline?: string | null;
  logo?: string | null;
  accesos: Acceso[];
}) {
  return (
    <header className="relative overflow-hidden px-5 pb-5 pt-7 text-center">
      {/* Fondo rosado con el tema de la tienda (como el mockup: degradado + halo) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-durazno/45 via-miel/70 to-crema"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-44 bg-[radial-gradient(60%_45%_at_50%_0%,var(--color-durazno)_0%,transparent_70%)] opacity-40"
      />

      {/* Destellos */}
      <span className="bq-sparkle absolute left-9 top-5 text-sm text-white drop-shadow-[0_0_4px_var(--color-durazno)]">✦</span>
      <span className="bq-sparkle absolute right-10 top-14 text-lg text-white [animation-delay:.6s] drop-shadow-[0_0_4px_var(--color-durazno)]">✧</span>
      <span className="bq-sparkle absolute left-6 top-28 text-xs text-white [animation-delay:1.1s] drop-shadow-[0_0_4px_var(--color-durazno)]">✦</span>
      <span className="bq-sparkle absolute right-20 top-7 text-[10px] text-white [animation-delay:1.5s] drop-shadow-[0_0_4px_var(--color-durazno)]">✧</span>

      <div className="relative">
        {/* Avatar con aro dorado */}
        <div
          className="mx-auto h-[124px] w-[124px] rounded-full p-[5px] shadow-[0_10px_26px_rgba(160,40,90,.28)]"
          style={{ background: ANILLO_ORO }}
        >
          <span className="relative block h-full w-full overflow-hidden rounded-full border-[3px] border-white bg-crema">
            {logo && (
              <Image src={logo} alt={marca} fill sizes="124px" className="object-cover" priority />
            )}
          </span>
        </div>

        {/* Nombre en cursiva */}
        <h1 className="font-script mt-3 text-5xl leading-none text-coral drop-shadow-[0_2px_10px_rgba(197,30,99,.18)]">
          {marca}
        </h1>

        {subtitulo && (
          <p
            className="font-titulo mt-1 text-[11px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: ORO }}
          >
            {subtitulo}
          </p>
        )}
        {handle && <p className="mt-1.5 text-xs text-cacao">{handle}</p>}
        {tagline && (
          <p className="mx-auto mt-2 max-w-[300px] text-[13px] leading-relaxed text-texto">
            {tagline}
          </p>
        )}

        {/* Accesos en píldoras */}
        {accesos.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {accesos.map(({ href, label, Icon }) => {
              const esWa = label.toLowerCase() === "whatsapp";
              return (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={
                    esWa
                      ? "flex items-center gap-1.5 rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] px-3.5 py-2 text-xs font-medium text-white shadow-sm transition active:scale-95"
                      : "flex items-center gap-1.5 rounded-full border border-miel-borde bg-white px-3.5 py-2 text-xs font-medium text-texto shadow-sm transition active:scale-95"
                  }
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </a>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}
