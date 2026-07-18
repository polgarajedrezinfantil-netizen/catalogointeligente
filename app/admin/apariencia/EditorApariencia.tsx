"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { SubirFotos } from "@/components/SubirFotos";
import { urlFoto } from "@/lib/fotos";
import { TEMA_DEFAULT, TOKENS_TEMA, temaStyle, type Tema } from "@/lib/tema";
import { guardarApariencia, type EstadoApariencia } from "./actions";

const inputCls =
  "rounded-xl border border-miel-borde bg-crema px-3 py-2 outline-none focus:border-verde-mielina";

type Props = {
  tiendaId: string;
  nombre: string;
  marca: string;
  handle: string | null;
  logoUrl: string | null;
  tema: Tema;
  subtitulo: string;
  descripcion: string;
  ogTitulo: string;
  ogDescripcion: string;
  banner: string;
  landingActiva: boolean;
  slug: string;
};

export function EditorApariencia(props: Props) {
  const [estado, accion, pendiente] = useActionState<EstadoApariencia, FormData>(
    guardarApariencia,
    null,
  );
  const [tema, setTema] = useState<Tema>({ ...TEMA_DEFAULT, ...props.tema });
  const [subtitulo, setSubtitulo] = useState(props.subtitulo);
  const [descripcion, setDescripcion] = useState(props.descripcion);
  const [ogTitulo, setOgTitulo] = useState(props.ogTitulo);
  const [ogDescripcion, setOgDescripcion] = useState(props.ogDescripcion);
  const [banner, setBanner] = useState(props.banner);
  const [landingActiva, setLandingActiva] = useState(props.landingActiva);

  const setColor = (key: string, val: string) =>
    setTema((t) => ({ ...t, [key]: val }));

  return (
    <form action={accion} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* ----- Controles ----- */}
      <div className="space-y-6">
        {/* Textos */}
        <section className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-5">
          <h2 className="mb-4 font-titulo text-lg text-coral">Textos</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-cacao sm:col-span-2">
              Eslogan / subtítulo
              <input
                name="subtitulo"
                value={subtitulo}
                onChange={(e) => setSubtitulo(e.target.value)}
                placeholder="miel & protección"
                className={`mt-1 w-full ${inputCls}`}
              />
            </label>
            <label className="text-sm font-semibold text-cacao sm:col-span-2">
              Descripción de la tienda
              <textarea
                name="descripcion"
                rows={2}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ropa y más para bebés 🍯"
                className={`mt-1 w-full ${inputCls}`}
              />
            </label>
          </div>
        </section>

        {/* Banner / portada */}
        <section className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-5">
          <h2 className="mb-1 font-titulo text-lg text-coral">Portada / banner</h2>
          <p className="mb-4 text-sm text-cacao">
            Imagen ancha que se muestra arriba del catálogo (opcional).
          </p>
          <SubirFotos
            name="banner"
            tiendaId={props.tiendaId}
            paths={banner ? [banner] : []}
            onCambio={(p) => setBanner(p[0] ?? "")}
          />
        </section>

        {/* Paleta */}
        <section className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-titulo text-lg text-coral">Paleta de colores</h2>
            <button
              type="button"
              onClick={() => setTema({ ...TEMA_DEFAULT })}
              className="rounded-full border border-miel-borde px-3 py-1 text-sm font-semibold"
            >
              Restaurar marca
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {TOKENS_TEMA.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <input
                  type="color"
                  value={tema[key] ?? "#000000"}
                  onChange={(e) => setColor(key, e.target.value)}
                  className="h-9 w-10 shrink-0 rounded-lg border border-miel-borde"
                  aria-label={label}
                />
                <input
                  value={tema[key] ?? ""}
                  onChange={(e) => setColor(key, e.target.value)}
                  className="w-24 rounded-lg border border-miel-borde bg-crema px-2 py-1 font-mono text-sm uppercase"
                />
                <span className="text-sm text-cacao">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Preview social (OG) */}
        <section className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-5">
          <h2 className="mb-1 font-titulo text-lg text-coral">
            Vista al compartir el link (WhatsApp/redes)
          </h2>
          <p className="mb-4 text-sm text-cacao">
            Lo que se ve cuando alguien comparte tu catálogo. Si lo dejas vacío,
            usamos el nombre y la portada/logo.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-cacao">
              Título al compartir
              <input
                name="og_titulo"
                value={ogTitulo}
                onChange={(e) => setOgTitulo(e.target.value)}
                placeholder={props.marca}
                className={`mt-1 w-full ${inputCls}`}
              />
            </label>
            <label className="text-sm font-semibold text-cacao">
              Descripción al compartir
              <input
                name="og_descripcion"
                value={ogDescripcion}
                onChange={(e) => setOgDescripcion(e.target.value)}
                placeholder="Ropa y más para bebés 🍯"
                className={`mt-1 w-full ${inputCls}`}
              />
            </label>
          </div>
        </section>

        {/* Landing de bienvenida */}
        <section className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-5">
          <h2 className="mb-1 font-titulo text-lg text-coral">
            Página de bienvenida
          </h2>
          <p className="mb-4 text-sm text-cacao">
            Muestra una portada (logo, frase y productos destacados) antes del
            catálogo. Si la apagas, tu link entra directo al catálogo.
          </p>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              name="landing_activa"
              checked={landingActiva}
              onChange={(e) => setLandingActiva(e.target.checked)}
              className="h-5 w-5 shrink-0 accent-verde-mielina"
            />
            <span className="text-sm font-semibold text-texto">
              Mostrar página de bienvenida antes del catálogo
            </span>
          </label>
          {landingActiva && (
            <a
              href={`https://${props.slug}.myelplay.com`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm font-bold text-verde-mielina hover:underline"
            >
              Ver mi página de bienvenida →
            </a>
          )}
        </section>

        {/* Campo oculto con el tema + guardar */}
        <input type="hidden" name="tema" value={JSON.stringify(tema)} readOnly />
        <div className="flex items-center gap-3">
          <button
            disabled={pendiente}
            className="rounded-full bg-verde-mielina px-6 py-2.5 font-bold text-white disabled:opacity-60"
          >
            {pendiente ? "Guardando…" : "Guardar apariencia"}
          </button>
          {estado && (
            <span className={`text-sm ${estado.ok ? "text-[#3f5a1c]" : "text-durazno"}`}>
              {estado.mensaje}
            </span>
          )}
        </div>
      </div>

      {/* ----- Vista previa en vivo ----- */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <p className="mb-2 text-sm font-semibold text-cacao">Vista previa</p>
        <div
          style={temaStyle(tema)}
          className="overflow-hidden rounded-[var(--radius-marca)] border border-miel-borde bg-crema shadow-sm"
        >
          {/* Banner */}
          {banner && (
            <div className="relative aspect-[16/7] w-full">
              <Image src={urlFoto(banner)} alt="portada" fill sizes="320px" className="object-cover" />
            </div>
          )}
          {/* Encabezado */}
          <div className="flex items-center gap-2.5 border-b border-miel-borde bg-white/95 px-3 py-2.5">
            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gradient-to-tr from-sol via-durazno to-coral p-[2px]">
              <span className="relative block h-full w-full overflow-hidden rounded-full border-2 border-white bg-crema">
                {props.logoUrl && (
                  <Image src={urlFoto(props.logoUrl)} alt="logo" fill sizes="32px" className="object-cover" />
                )}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <p className="font-producto text-sm font-bold text-texto">{props.marca}</p>
                {props.handle && <span className="font-mano text-xs text-cacao">· {props.handle}</span>}
              </div>
              {subtitulo && <p className="font-mano text-xs leading-tight text-cacao">{subtitulo}</p>}
            </div>
          </div>
          {/* Accesos */}
          <div className="flex gap-1.5 border-b border-miel-borde px-2.5 py-2">
            <span className="flex-1 rounded-xl border border-miel-borde bg-white py-1.5 text-center text-[11px] font-bold text-texto">Cómo llegar</span>
            <span className="flex-1 rounded-xl border border-miel-borde bg-white py-1.5 text-center text-[11px] font-bold text-texto">WhatsApp</span>
          </div>
          {/* Chips */}
          <div className="flex gap-2 px-2.5 py-2">
            <span className="rounded-full bg-verde-mielina px-3 py-1 text-xs font-semibold text-white">Todo</span>
            <span className="rounded-full border border-miel-borde bg-white px-3 py-1 text-xs font-semibold text-texto">👦 Niño</span>
            <span className="rounded-full border border-miel-borde bg-white px-3 py-1 text-xs font-semibold text-texto">👧 Niña</span>
          </div>
          {/* Tarjetas */}
          <div className="grid grid-cols-2 gap-2 px-2.5 pb-3">
            {[1, 2].map((i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-miel-borde bg-white">
                <div className="flex aspect-[4/5] items-center justify-center bg-miel/40 text-2xl">🧸</div>
                <div className="p-2">
                  <p className="truncate text-xs font-semibold text-texto">Producto {i}</p>
                  <span className="mt-1 inline-flex rounded-full bg-verde-mielina px-2 py-0.5 text-xs font-bold text-white">$150</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs text-cacao">Así se verá tu catálogo con estos colores.</p>
      </div>
    </form>
  );
}
