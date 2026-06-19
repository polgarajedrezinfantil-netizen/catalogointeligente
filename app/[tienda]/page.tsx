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

  return (
    // Marco tipo teléfono: centrado, con gutters en escritorio (como ver IG en web).
    <div className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col bg-white shadow-xl">
      <CapturaCliente tiendaId={tienda.id} />

      {/* Barra superior estilo IG */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-miel-borde bg-white/95 px-4 py-2.5 backdrop-blur">
        <div className="relative h-9 w-9 overflow-hidden rounded-full bg-gradient-to-tr from-sol via-durazno to-coral p-[2px]">
          <span className="relative block h-full w-full overflow-hidden rounded-full border-2 border-white bg-crema">
            {tienda.logo_url && (
              <Image src={urlFoto(tienda.logo_url)} alt={tienda.nombre} fill sizes="36px" className="object-cover" />
            )}
          </span>
        </div>
        <div className="leading-tight">
          <p className="font-producto text-base font-bold text-texto">{tienda.nombre}</p>
          <p className="font-mano text-sm text-cacao">Los Nidos de Mamielina</p>
        </div>
      </header>

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
