import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { urlFoto } from "@/lib/fotos";
import { temaStyle } from "@/lib/tema";
import { hexDeColor } from "@/lib/colores";
import type { Campo, Linea, Producto, Tienda } from "@/lib/tipos";
import { BotonCompartir } from "@/components/BotonCompartir";

// Carga el producto (de una tienda activa y visible) junto con su tienda.
async function cargar(id: string) {
  const supabase = await createClient();
  const { data: prod } = await supabase
    .from("productos")
    .select("*")
    .eq("id", id)
    .eq("oculto", false)
    .maybeSingle();
  if (!prod) return null;
  const producto = prod as Producto;
  const { data: tiendaData } = await supabase
    .from("tiendas")
    .select("*")
    .eq("id", producto.tienda_id)
    .eq("activa", true)
    .maybeSingle();
  if (!tiendaData) return null;
  return { producto, tienda: tiendaData as Tienda };
}

function precioEfectivo(p: Producto) {
  return p.precio_oferta != null ? p.precio_oferta : p.precio;
}

// Preview social propia del producto (foto + nombre + precio).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await cargar(id);
  if (!data) return {};
  const { producto, tienda } = data;
  const marca = tienda.nombre.split(" - ")[0];
  const simbolo = tienda.etiqueta_precio ?? "$";
  const titulo = `${producto.nombre} · ${marca}`;
  const precio = precioEfectivo(producto);
  const desc =
    `${simbolo}${precio}` +
    (producto.precio_oferta != null ? ` (antes ${simbolo}${producto.precio})` : "") +
    (producto.descripcion ? ` — ${producto.descripcion}` : "");
  const img = producto.fotos?.[0]
    ? urlFoto(producto.fotos[0])
    : tienda.banner_url
      ? urlFoto(tienda.banner_url)
      : tienda.logo_url
        ? urlFoto(tienda.logo_url)
        : "/og.jpg";

  return {
    title: titulo,
    description: desc,
    openGraph: { title: titulo, description: desc, images: [{ url: img }], type: "website" },
    twitter: { card: "summary_large_image", title: titulo, description: desc, images: [img] },
  };
}

export default async function ProductoCompartido({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await cargar(id);
  if (!data) notFound();
  const { producto, tienda } = data;
  const supabase = await createClient();

  const [{ data: lineaData }, { data: camposData }] = await Promise.all([
    producto.linea_id
      ? supabase.from("lineas_de_venta").select("*").eq("id", producto.linea_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("campos_linea").select("*").eq("tienda_id", tienda.id).eq("archivado", false).order("orden"),
  ]);
  const linea = (lineaData ?? null) as Linea | null;
  const campos = ((camposData ?? []) as Campo[]).filter((c) => c.linea_id === producto.linea_id);

  const marca = tienda.nombre.split(" - ")[0];
  const simbolo = tienda.etiqueta_precio ?? "$";
  const fotos = producto.fotos?.length ? producto.fotos : [];
  const enTienda = `/${tienda.slug}?p=${producto.id}`;

  return (
    <div
      className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col bg-white shadow-xl"
      style={temaStyle(tienda.tema)}
    >
      {/* Encabezado de la tienda (lleva al catálogo) */}
      <Link href={`/${tienda.slug}`} className="flex items-center gap-2.5 border-b border-miel-borde bg-white px-4 py-2.5">
        <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gradient-to-tr from-sol via-durazno to-coral p-[2px]">
          <span className="relative block h-full w-full overflow-hidden rounded-full border-2 border-white bg-crema">
            {tienda.logo_url && (
              <Image src={urlFoto(tienda.logo_url)} alt={marca} fill sizes="32px" className="object-cover" />
            )}
          </span>
        </span>
        <div className="min-w-0">
          <p className="font-producto text-base font-bold text-texto">{marca}</p>
          {tienda.subtitulo && <p className="font-mano text-sm leading-tight text-cacao">{tienda.subtitulo}</p>}
        </div>
      </Link>

      {/* Fotos */}
      <div className="flex snap-x snap-mandatory overflow-x-auto bg-crema">
        {(fotos.length ? fotos : [""]).map((f, i) => (
          <div key={i} className="relative aspect-square w-full shrink-0 snap-center bg-miel/30">
            {f && (
              <Image
                src={urlFoto(f)}
                alt={`${producto.nombre} ${i + 1}`}
                fill
                sizes="(max-width: 460px) 100vw, 460px"
                className="object-cover"
                priority={i === 0}
              />
            )}
            {fotos.length > 1 && (
              <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-xs font-bold text-white">
                {i + 1}/{fotos.length}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Datos */}
      <div className="space-y-3 p-4">
        <h1 className="font-producto text-xl font-bold text-texto">{producto.nombre}</h1>

        <div className="flex flex-wrap items-center gap-2">
          {producto.precio_oferta != null ? (
            <p className="font-producto text-2xl font-bold text-coral">
              {simbolo}{producto.precio_oferta}
              <span className="ml-1.5 text-base font-semibold text-cacao line-through">{simbolo}{producto.precio}</span>
              <span className="ml-2 rounded-full bg-coral px-2 py-0.5 text-xs font-bold text-white">🏷️ Oferta</span>
            </p>
          ) : (
            <p className="font-producto text-2xl font-bold text-[#7a5414]">{simbolo}{producto.precio}</p>
          )}
        </div>

        {linea && <p className="text-xs text-cacao">{linea.icono} {linea.nombre}</p>}
        {producto.descripcion && <p className="text-sm text-texto">{producto.descripcion}</p>}

        {/* Atributos (talla, color con muestra…) */}
        <ul className="flex flex-wrap gap-2">
          {campos.map((c) => {
            const v = producto.atributos?.[c.id];
            if (v == null || v === "") return null;
            const vals = Array.isArray(v) ? v.map(String) : [String(v)];
            const esColor = c.nombre.trim().toLowerCase() === "color";
            return (
              <li key={c.id} className="rounded-full bg-crema px-2 py-1 text-xs text-cacao">
                <strong>{c.nombre}:</strong>{" "}
                {esColor ? (
                  <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 align-middle">
                    {vals.map((val) => {
                      const hex = hexDeColor(val);
                      return (
                        <span key={val} className="inline-flex items-center gap-1">
                          {hex && <span className="inline-block h-3 w-3 rounded-full border border-black/10" style={{ background: hex }} />}
                          {val}
                        </span>
                      );
                    })}
                  </span>
                ) : (
                  vals.join(", ")
                )}
              </li>
            );
          })}
        </ul>

        {/* Acciones */}
        <div className="space-y-2 pt-2">
          <Link
            href={enTienda}
            className="block w-full rounded-full bg-verde-mielina py-3 text-center font-producto font-bold text-white"
          >
            Verla en la tienda 🍯
          </Link>
          <BotonCompartir
            url={`/p/${producto.id}`}
            titulo={`${producto.nombre} · ${marca}`}
            texto={`Mira "${producto.nombre}" (${simbolo}${precioEfectivo(producto)}) en ${marca}:`}
            label="Compartir este producto"
          />
        </div>

        <p className="pt-2 text-center text-xs text-cacao">
          ¿Te gustó? Compártelo con quien quieras. 🍯
        </p>
      </div>
    </div>
  );
}
