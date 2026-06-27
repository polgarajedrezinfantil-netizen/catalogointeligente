import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { urlFoto } from "@/lib/fotos";

/**
 * Feed JSON público del catálogo de una tienda.
 *   GET /<slug>/productos.json
 *
 * Sirve, en formato máquina, lo MISMO que el storefront muestra en HTML:
 * usa la anon key y las políticas RLS públicas (tiendas.activa = true), así que
 * no expone columnas sensibles (costo, ganancia, datos de pago, hold, etc.).
 *
 * Pensado para que un agente de ventas externo lea catálogo, precio, tallas y
 * existencia como fuente única. Parámetro opcional ?solo=disponibles para
 * devolver únicamente las piezas vendibles (estado disponible y cantidad > 0).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ tienda: string }> },
) {
  const { tienda: slug } = await params;
  const origin = new URL(req.url).origin;
  const soloDisponibles = new URL(req.url).searchParams.get("solo") === "disponibles";

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
  };

  try {
    const supabase = await createClient();

    const { data: tienda } = await supabase
      .from("tiendas")
      .select("id, slug, nombre, moneda, etiqueta_precio")
      .eq("slug", slug)
      .eq("activa", true)
      .maybeSingle();

    if (!tienda) {
      return NextResponse.json(
        { error: "Tienda no encontrada o inactiva" },
        { status: 404, headers },
      );
    }

    const [{ data: productosRaw }, { data: lineas }, { data: campos }] =
      await Promise.all([
        supabase
          .from("productos")
          .select(
            "id, nombre, descripcion, precio, precio_oferta, cantidad, fotos, atributos, categoria, genero, estado, linea_id, creado",
          )
          .eq("tienda_id", tienda.id)
          .eq("oculto", false)
          .order("orden", { ascending: true })
          .order("creado", { ascending: false }),
        supabase
          .from("lineas_de_venta")
          .select("id, nombre")
          .eq("tienda_id", tienda.id),
        supabase
          .from("campos_linea")
          .select("id, nombre")
          .eq("tienda_id", tienda.id),
      ]);

    // Mapas para traducir ids a nombres legibles.
    const nombreLinea = new Map((lineas ?? []).map((l) => [l.id, l.nombre]));
    const nombreCampo = new Map((campos ?? []).map((c) => [c.id, c.nombre]));

    const productos = (productosRaw ?? [])
      .map((p) => {
        const precio = p.precio_oferta != null ? p.precio_oferta : p.precio;
        const disponible = p.estado === "disponible" && p.cantidad > 0;

        // atributos: { campo_id: valor } -> { "Talla": "4", "Color": "Rosa" }
        const atributos: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(p.atributos ?? {})) {
          if (v == null || v === "") continue;
          atributos[nombreCampo.get(k) ?? k] = v;
        }

        return {
          id: p.id,
          nombre: p.nombre,
          descripcion: p.descripcion,
          precio,
          precio_lista: p.precio,
          oferta: p.precio_oferta != null,
          existencia: p.cantidad,
          disponible,
          estado: p.estado,
          linea: p.linea_id ? (nombreLinea.get(p.linea_id) ?? null) : null,
          categoria: p.categoria,
          genero: p.genero,
          atributos,
          fotos: (p.fotos ?? []).map(urlFoto).filter(Boolean),
          url: `${origin}/p/${p.id}`,
        };
      })
      .filter((p) => !soloDisponibles || p.disponible);

    return NextResponse.json(
      {
        tienda: {
          slug: tienda.slug,
          nombre: tienda.nombre.split(" - ")[0],
          moneda: tienda.moneda,
          simbolo: tienda.etiqueta_precio,
        },
        generado: new Date().toISOString(),
        total: productos.length,
        productos,
      },
      { headers },
    );
  } catch (e) {
    const detalle = e instanceof Error ? e.message : "Error al generar el feed";
    return NextResponse.json({ error: detalle }, { status: 500, headers });
  }
}
