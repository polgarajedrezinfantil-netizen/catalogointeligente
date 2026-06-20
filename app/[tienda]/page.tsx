import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { urlFoto } from "@/lib/fotos";
import { temaStyle } from "@/lib/tema";
import type { Campo, Linea, Nido, Producto, Tienda } from "@/lib/tipos";
import { CapturaCliente } from "./CapturaCliente";
import { CatalogoCliente } from "./CatalogoCliente";
import { BarraInferior } from "./BarraInferior";
import type { ComponentType } from "react";
import { IconoMaps, IconoWhatsApp, IconoInstagram, IconoFacebook, IconoTikTok } from "@/components/IconosMarca";

// Preview social (OG) por tienda: título, descripción e imagen propios.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ tienda: string }>;
}): Promise<Metadata> {
  const { tienda: slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("tiendas")
    .select("nombre, og_titulo, og_descripcion, descripcion, bio, banner_url, logo_url")
    .eq("slug", slug)
    .eq("activa", true)
    .maybeSingle();
  if (!data) return {};

  const marca = String(data.nombre).split(" - ")[0];
  const titulo = data.og_titulo || marca;
  const desc =
    data.og_descripcion || data.descripcion || data.bio || `Catálogo de ${marca}`;
  const img = data.banner_url
    ? urlFoto(data.banner_url)
    : data.logo_url
      ? urlFoto(data.logo_url)
      : "/og.jpg";

  return {
    title: titulo,
    description: desc,
    openGraph: { title: titulo, description: desc, images: [{ url: img }] },
    twitter: { card: "summary_large_image", title: titulo, description: desc, images: [img] },
  };
}

// Catálogo público de una tienda: nidos.myelplay.com/<slug>
// Diseño mobile-first con "ilusión de Instagram" (90% entran desde celular).
export default async function CatalogoPublico({
  params,
}: {
  params: Promise<{ tienda: string }>;
}) {
  const { tienda: slug } = await params;
  const supabase = await createClient();

  const { data: tiendaData } = await supabase
    .from("tiendas")
    .select("*")
    .eq("slug", slug)
    .eq("activa", true)
    .maybeSingle();

  if (!tiendaData) notFound();
  const tienda = tiendaData as Tienda;

  const [{ data: nidos }, { data: lineas }, { data: campos }, { data: productos }] =
    await Promise.all([
      supabase.from("nidos").select("*").eq("tienda_id", tienda.id).eq("activo", true).order("orden"),
      supabase.from("lineas_de_venta").select("*").eq("tienda_id", tienda.id).eq("archivada", false).order("orden"),
      supabase.from("campos_linea").select("*").eq("tienda_id", tienda.id).eq("es_filtro", true).eq("archivado", false).order("orden"),
      supabase.from("productos").select("*").eq("tienda_id", tienda.id).order("creado", { ascending: false }),
    ]);

  const waUrl = tienda.whatsapp ? `https://wa.me/${tienda.whatsapp.replace(/\D/g, "")}` : null;
  const marca = tienda.nombre.split(" - ")[0];
  const handle = tienda.instagram_url
    ? "@" + tienda.instagram_url.replace(/\/+$/, "").split("/").pop()
    : null;

  // Accesos rápidos (botones con icono de marca). Solo los configurados.
  type Acceso = { href: string; label: string; Icon: ComponentType<{ className?: string }> };
  const accesos: Acceso[] = [
    tienda.maps_url && { href: tienda.maps_url, label: "Cómo llegar", Icon: IconoMaps },
    waUrl && { href: waUrl, label: "WhatsApp", Icon: IconoWhatsApp },
    tienda.instagram_url && { href: tienda.instagram_url, label: "Instagram", Icon: IconoInstagram },
    tienda.facebook_url && { href: tienda.facebook_url, label: "Facebook", Icon: IconoFacebook },
    tienda.tiktok_url && { href: tienda.tiktok_url, label: "TikTok", Icon: IconoTikTok },
  ].filter(Boolean) as Acceso[];

  return (
    // Marco tipo teléfono: centrado, con gutters en escritorio (como ver IG en web).
    // El `style` con el tema de la tienda re-tematiza todo el catálogo en runtime.
    <div
      className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col bg-white shadow-xl"
      style={temaStyle(tienda.tema)}
    >
      <CapturaCliente tiendaId={tienda.id} />

      {/* Portada / banner (opcional) */}
      {tienda.banner_url && (
        <div className="relative aspect-[16/7] w-full overflow-hidden">
          <Image
            src={urlFoto(tienda.banner_url)}
            alt={`Portada de ${marca}`}
            fill
            sizes="460px"
            className="object-cover"
            priority
          />
        </div>
      )}

      {/* Barra superior estilo IG (compacta, sticky) */}
      <header className="sticky top-0 z-30 flex items-center gap-2.5 border-b border-miel-borde bg-white/95 px-4 py-2.5 backdrop-blur">
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gradient-to-tr from-sol via-durazno to-coral p-[2px]">
          <span className="relative block h-full w-full overflow-hidden rounded-full border-2 border-white bg-crema">
            {tienda.logo_url && (
              <Image src={urlFoto(tienda.logo_url)} alt={tienda.nombre} fill sizes="32px" className="object-cover" />
            )}
          </span>
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <p className="font-producto text-base font-bold text-texto">{marca}</p>
            {handle && <span className="font-mano text-sm text-cacao">· {handle}</span>}
          </div>
          {tienda.subtitulo && (
            <p className="font-mano text-sm leading-tight text-cacao">{tienda.subtitulo}</p>
          )}
        </div>
      </header>

      {/* Accesos rápidos: una sola fila con los iconos de cada marca */}
      {accesos.length > 0 && (
        <div
          className="grid gap-1.5 border-b border-miel-borde px-2.5 py-3"
          style={{ gridTemplateColumns: `repeat(${accesos.length}, minmax(0,1fr))` }}
        >
          {accesos.map(({ href, label, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 rounded-2xl border border-miel-borde bg-white py-2 transition active:scale-95"
            >
              <Icon className="h-6 w-6" />
              <span className="text-center text-[11px] font-bold leading-tight text-texto">{label}</span>
            </a>
          ))}
        </div>
      )}

      {/* Contenido */}
      <div className="flex-1 px-2 pb-24 pt-3">
        <CatalogoCliente
          tienda={{ id: tienda.id, simbolo: tienda.etiqueta_precio, whatsapp: tienda.whatsapp, datosPago: tienda.datos_pago }}
          nidos={(nidos ?? []) as Nido[]}
          lineas={(lineas ?? []) as Linea[]}
          campos={(campos ?? []) as Campo[]}
          productos={(productos ?? []) as Producto[]}
        />
      </div>

      {/* Barra inferior estilo IG */}
      <BarraInferior whatsapp={tienda.whatsapp} />
    </div>
  );
}
