import Image from "next/image";
import Link from "next/link";
import type { ComponentType } from "react";
import { createClient } from "@/lib/supabase/server";
import { urlFoto } from "@/lib/fotos";
import { temaStyle } from "@/lib/tema";
import type { Producto, Tienda } from "@/lib/tipos";
import {
  IconoMaps,
  IconoWhatsApp,
  IconoInstagram,
  IconoFacebook,
  IconoTikTok,
} from "@/components/IconosMarca";

// Landing de bienvenida de una tienda (se muestra en <tienda>.myelplay.com
// cuando landing_activa = true). Hero + productos destacados + contacto, con
// el catálogo a un clic. Todo sale de los datos que la tienda ya tiene, y se
// re-tematiza con SU paleta (temaStyle) igual que el catálogo.
export async function LandingTienda({ slug }: { slug: string }) {
  const supabase = await createClient();

  const { data: tiendaData } = await supabase
    .from("tiendas")
    .select("*")
    .eq("slug", slug)
    .eq("activa", true)
    .maybeSingle();
  if (!tiendaData) {
    // La tienda dejó de existir/activarse entre el resolver de host y aquí.
    return null;
  }
  const tienda = tiendaData as Tienda;

  // Productos "gancho": visibles, con foto y aún ofrecibles (no vendidas/agotadas).
  const { data: prods } = await supabase
    .from("productos")
    .select("id, nombre, precio, precio_oferta, fotos, estado")
    .eq("tienda_id", tienda.id)
    .eq("oculto", false)
    .order("orden", { ascending: true })
    .order("creado", { ascending: false })
    .limit(24);

  const destacados = ((prods ?? []) as Pick<
    Producto,
    "id" | "nombre" | "precio" | "precio_oferta" | "fotos" | "estado"
  >[])
    .filter((p) => p.fotos?.[0] && p.estado !== "vendida" && p.estado !== "agotada")
    .slice(0, 6);

  const marca = tienda.nombre.split(" - ")[0];
  const tagline = tienda.descripcion || tienda.subtitulo || tienda.bio;
  const simbolo = tienda.etiqueta_precio || "$";
  const catalogoHref = `/${tienda.slug}`;

  const waUrl = tienda.whatsapp
    ? `https://wa.me/${tienda.whatsapp.replace(/\D/g, "")}`
    : null;

  const precio = (n: number) =>
    `${simbolo}${Number(n).toLocaleString("es-MX")}`;

  type Acceso = {
    href: string;
    label: string;
    Icon: ComponentType<{ className?: string }>;
  };
  const accesos: Acceso[] = (
    [
      waUrl && { href: waUrl, label: "WhatsApp", Icon: IconoWhatsApp },
      tienda.instagram_url && {
        href: tienda.instagram_url,
        label: "Instagram",
        Icon: IconoInstagram,
      },
      tienda.facebook_url && {
        href: tienda.facebook_url,
        label: "Facebook",
        Icon: IconoFacebook,
      },
      tienda.tiktok_url && {
        href: tienda.tiktok_url,
        label: "TikTok",
        Icon: IconoTikTok,
      },
      tienda.maps_url && {
        href: tienda.maps_url,
        label: "Cómo llegar",
        Icon: IconoMaps,
      },
    ].filter(Boolean) as Acceso[]
  );

  return (
    <main
      style={temaStyle(tienda.tema)}
      className="flex min-h-screen flex-col bg-crema text-texto"
    >
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        {tienda.banner_url ? (
          <div className="absolute inset-0">
            <Image
              src={urlFoto(tienda.banner_url)}
              alt={`Portada de ${marca}`}
              fill
              sizes="100vw"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/35 to-black/20" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-miel via-crema to-durazno/50" />
        )}

        <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-5 px-6 py-20 text-center">
          {tienda.logo_url && (
            <span className="grid h-24 w-24 place-items-center overflow-hidden rounded-full border-4 border-white/80 bg-white shadow-lg">
              <Image
                src={urlFoto(tienda.logo_url)}
                alt={marca}
                width={96}
                height={96}
                className="h-full w-full object-cover"
                priority
              />
            </span>
          )}
          <h1
            className={`font-titulo text-4xl font-bold sm:text-5xl ${
              tienda.banner_url ? "text-white drop-shadow" : "text-texto"
            }`}
          >
            {marca}
          </h1>
          {tagline && (
            <p
              className={`max-w-xl text-lg ${
                tienda.banner_url ? "text-white/90 drop-shadow" : "text-cacao"
              }`}
            >
              {tagline}
            </p>
          )}

          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Link
              href={catalogoHref}
              className="rounded-full bg-verde-mielina px-8 py-3.5 text-lg font-bold text-white shadow-md transition hover:brightness-105 active:scale-95"
            >
              Ver catálogo
            </Link>
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/70 bg-white/90 px-8 py-3.5 text-lg font-bold text-texto shadow-sm transition hover:bg-white active:scale-95"
              >
                <IconoWhatsApp className="h-5 w-5" />
                Escríbenos
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ---------- Productos destacados ---------- */}
      {destacados.length > 0 && (
        <section className="mx-auto w-full max-w-4xl px-4 py-12">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="font-titulo text-2xl text-coral">Lo más nuevo</h2>
            <Link
              href={catalogoHref}
              className="text-sm font-bold text-cacao underline-offset-4 hover:underline"
            >
              Ver todo →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {destacados.map((p) => {
              const oferta = p.precio_oferta && p.precio_oferta < p.precio;
              return (
                <Link
                  key={p.id}
                  href={catalogoHref}
                  className="group overflow-hidden rounded-2xl border border-miel-borde bg-white shadow-sm transition hover:shadow-md"
                >
                  <div className="relative aspect-[4/5] w-full overflow-hidden bg-miel/30">
                    <Image
                      src={urlFoto(p.fotos[0])}
                      alt={p.nombre}
                      fill
                      sizes="(min-width: 640px) 240px, 45vw"
                      className="object-cover transition duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-sm font-semibold text-texto">
                      {p.nombre}
                    </p>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="inline-flex rounded-full bg-verde-mielina px-2.5 py-0.5 text-sm font-bold text-white">
                        {precio(oferta ? p.precio_oferta! : p.precio)}
                      </span>
                      {oferta && (
                        <span className="text-xs text-cacao line-through">
                          {precio(p.precio)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ---------- Contacto y redes ---------- */}
      {(accesos.length > 0 || tienda.direccion || tienda.horario) && (
        <section className="mx-auto w-full max-w-4xl px-4 pb-16">
          <div className="rounded-3xl border border-miel-borde bg-white p-6 text-center shadow-sm">
            <h2 className="font-titulo text-2xl text-coral">Contáctanos</h2>
            {(tienda.direccion || tienda.horario) && (
              <p className="mx-auto mt-2 max-w-md text-sm text-cacao">
                {[tienda.direccion, tienda.horario].filter(Boolean).join(" · ")}
              </p>
            )}
            {accesos.length > 0 && (
              <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                {accesos.map(({ href, label, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-miel-borde bg-crema px-4 py-2 text-sm font-bold text-texto transition hover:bg-miel/40 active:scale-95"
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ---------- Pie ---------- */}
      <footer className="mt-auto border-t border-miel-borde bg-white/60 py-6 text-center">
        <Link
          href={catalogoHref}
          className="text-sm font-bold text-verde-mielina hover:underline"
        >
          Entrar al catálogo de {marca}
        </Link>
        <nav className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-cacao">
          <Link href="/privacidad" className="hover:text-texto hover:underline">
            Aviso de privacidad
          </Link>
          <span aria-hidden className="text-miel-borde">·</span>
          <Link href="/eliminar-datos" className="hover:text-texto hover:underline">
            Eliminar mis datos
          </Link>
        </nav>
        <p className="mt-2 text-xs text-cacao">
          Hecho con MyelPlay · Catálogo en línea
        </p>
      </footer>
    </main>
  );
}
