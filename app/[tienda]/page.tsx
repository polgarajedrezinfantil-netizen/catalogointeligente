import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { urlFoto } from "@/lib/fotos";
import { temaStyle } from "@/lib/tema";
import type { Campo, GuiaTallas, Linea, Nido, Producto, Tienda } from "@/lib/tipos";
import { CapturaCliente } from "./CapturaCliente";
import { CatalogoCliente } from "./CatalogoCliente";
import MetaPixel from "@/components/MetaPixel";
import { BarraInferior } from "./BarraInferior";
import { BannerNovedades } from "./BannerNovedades";
import { HeroBoutique } from "./HeroBoutique";
import { ColeccionesBoutique, type Coleccion } from "./ColeccionesBoutique";
import { plantillaDe, clasePlantilla, tituloColeccion } from "@/lib/plantilla";
import { publicKeyDe } from "@/lib/agente/mp-oauth";
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

  const [{ data: nidos }, { data: lineas }, { data: campos }, { data: productos }, { data: guias }] =
    await Promise.all([
      supabase.from("nidos").select("*").eq("tienda_id", tienda.id).eq("activo", true).order("orden"),
      supabase.from("lineas_de_venta").select("*").eq("tienda_id", tienda.id).eq("archivada", false).order("orden"),
      supabase.from("campos_linea").select("*").eq("tienda_id", tienda.id).eq("es_filtro", true).eq("archivado", false).order("orden"),
      supabase.from("productos").select("*").eq("tienda_id", tienda.id).eq("oculto", false).order("orden", { ascending: true }).order("creado", { ascending: false }),
      supabase.from("guias_tallas").select("*").eq("tienda_id", tienda.id).eq("activa", true).order("orden"),
    ]);

  // % del cupón destacado (si está activo) para mostrarlo en el banner.
  let avisoPct: number | null = null;
  if (tienda.aviso_activo && tienda.aviso_cupon) {
    const { data: cup } = await supabase
      .from("cupones")
      .select("porcentaje")
      .eq("tienda_id", tienda.id)
      .eq("activo", true)
      .ilike("palabra", tienda.aviso_cupon.trim())
      .maybeSingle();
    avisoPct = cup ? Number(cup.porcentaje) : null;
  }

  const lineasT = (lineas ?? []) as Linea[];
  const productosT = (productos ?? []) as Producto[];

  // ¿La tienda conectó Mercado Pago? → ofrece "Pagar en línea" en el carrito.
  const pagoEnLinea = !!(await publicKeyDe(tienda.id));

  const waUrl = tienda.whatsapp ? `https://wa.me/${tienda.whatsapp.replace(/\D/g, "")}` : null;
  const marca = tienda.nombre.split(" - ")[0];
  const handle = tienda.instagram_url
    ? "@" + tienda.instagram_url.replace(/\/+$/, "").split("/").pop()
    : null;

  // Plantilla visual de la tienda (estructura/tipografías); la marca sigue
  // saliendo del tema. "boutique" = Gabrielle.
  const plantilla = plantillaDe(slug);
  const esBoutique = plantilla === "boutique";

  // Portadas de "Colecciones" (solo boutique): la primera foto de un producto
  // de cada línea de venta sirve de portada; si aún no hay, cae al ícono.
  const colecciones: Coleccion[] = esBoutique
    ? lineasT.map((l) => {
        const conFoto = productosT.find((p) => p.linea_id === l.id && p.fotos?.[0]);
        return {
          id: l.id,
          nombre: tituloColeccion(slug, l.nombre),
          icono: l.icono,
          cover: conFoto?.fotos?.[0] ? urlFoto(conFoto.fotos[0]) : null,
        };
      })
    : [];

  // Accesos rápidos (botones con icono de marca). Solo los configurados.
  // La boutique lleva WhatsApp primero (es el CTA del mockup); el default
  // conserva su orden histórico.
  type Acceso = { href: string; label: string; Icon: ComponentType<{ className?: string }> };
  const maps = tienda.maps_url && { href: tienda.maps_url, label: "Cómo llegar", Icon: IconoMaps };
  const wa = waUrl && { href: waUrl, label: "WhatsApp", Icon: IconoWhatsApp };
  const ig = tienda.instagram_url && { href: tienda.instagram_url, label: "Instagram", Icon: IconoInstagram };
  const fb = tienda.facebook_url && { href: tienda.facebook_url, label: "Facebook", Icon: IconoFacebook };
  const tt = tienda.tiktok_url && { href: tienda.tiktok_url, label: "TikTok", Icon: IconoTikTok };
  const accesos: Acceso[] = (esBoutique ? [wa, fb, ig, tt, maps] : [maps, wa, ig, fb, tt]).filter(
    Boolean,
  ) as Acceso[];

  return (
    // Marco tipo teléfono: centrado, con gutters en escritorio (como ver IG en web).
    // El `style` con el tema de la tienda re-tematiza todo el catálogo en runtime.
    <div
      className={`mx-auto flex min-h-screen w-full max-w-[460px] flex-col bg-white shadow-xl ${clasePlantilla(plantilla)}`}
      style={temaStyle(tienda.tema)}
    >
      <CapturaCliente tiendaId={tienda.id} />
      <MetaPixel pixelId={tienda.meta_pixel_id} />

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

      {esBoutique ? (
        /* Plantilla boutique (Gabrielle): encabezado tipo perfil con aro dorado */
        <HeroBoutique
          marca={marca}
          subtitulo={tienda.subtitulo}
          handle={handle ?? tienda.bio}
          tagline={tienda.descripcion}
          logo={tienda.logo_url ? urlFoto(tienda.logo_url) : null}
          accesos={accesos}
        />
      ) : (
        <>
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
        </>
      )}

      {/* Banner de novedades + cupón visible */}
      {tienda.aviso_activo && (
        <BannerNovedades
          tiendaId={tienda.id}
          texto={tienda.aviso_texto}
          cupon={tienda.aviso_cupon}
          porcentaje={avisoPct}
        />
      )}

      {/* Contenido */}
      <div className="flex-1 px-2 pb-24 pt-3">
        {esBoutique && <ColeccionesBoutique colecciones={colecciones} />}
        <CatalogoCliente
          tienda={{ id: tienda.id, marca, simbolo: tienda.etiqueta_precio, whatsapp: tienda.whatsapp, datosPago: tienda.datos_pago, slug: tienda.slug, pagoEnLinea }}
          nidos={(nidos ?? []) as Nido[]}
          lineas={lineasT}
          campos={(campos ?? []) as Campo[]}
          productos={productosT}
          guias={(guias ?? []) as GuiaTallas[]}
          boutique={esBoutique}
        />
      </div>

      {/* Barra inferior estilo IG */}
      <BarraInferior whatsapp={tienda.whatsapp} boutique={esBoutique} />
    </div>
  );
}
