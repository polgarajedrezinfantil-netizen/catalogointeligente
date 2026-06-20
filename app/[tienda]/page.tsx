import { notFound } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { urlFoto } from "@/lib/fotos";
import type { Campo, Linea, Nido, Producto, Tienda } from "@/lib/tipos";
import { CapturaCliente } from "./CapturaCliente";
import { CatalogoCliente } from "./CatalogoCliente";
import { BarraInferior } from "./BarraInferior";

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

  return (
    // Marco tipo teléfono: centrado, con gutters en escritorio (como ver IG en web).
    <div className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col bg-white shadow-xl">
      <CapturaCliente tiendaId={tienda.id} />

      {/* Barra superior estilo IG (compacta, sticky) */}
      <header className="sticky top-0 z-30 flex items-center gap-2.5 border-b border-miel-borde bg-white/95 px-4 py-2.5 backdrop-blur">
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gradient-to-tr from-sol via-durazno to-coral p-[2px]">
          <span className="relative block h-full w-full overflow-hidden rounded-full border-2 border-white bg-crema">
            {tienda.logo_url && (
              <Image src={urlFoto(tienda.logo_url)} alt={tienda.nombre} fill sizes="32px" className="object-cover" />
            )}
          </span>
        </div>
        <p className="font-producto text-base font-bold text-texto">{marca}</p>
        {handle && <span className="font-mano text-sm text-cacao">· {handle}</span>}
      </header>

      {/* Accesos rápidos (para que los productos se vean de inmediato) */}
      <div className="flex flex-wrap gap-2 border-b border-miel-borde px-3 py-2.5">
        {tienda.maps_url && (
          <a
            href={tienda.maps_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-verde-mielina px-3.5 py-1.5 text-sm font-bold text-white"
          >
            📍 Cómo llegar
          </a>
        )}
        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-miel-borde bg-white px-3.5 py-1.5 text-sm font-bold text-texto"
          >
            💬 WhatsApp
          </a>
        )}
        {tienda.instagram_url && (
          <a
            href={tienda.instagram_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-miel-borde bg-white px-3.5 py-1.5 text-sm font-bold text-texto"
          >
            📸 Instagram
          </a>
        )}
        {tienda.facebook_url && (
          <a
            href={tienda.facebook_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-miel-borde bg-white px-3.5 py-1.5 text-sm font-bold text-texto"
          >
            👍 Facebook
          </a>
        )}
      </div>

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
