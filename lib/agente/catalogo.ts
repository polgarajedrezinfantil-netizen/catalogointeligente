// Herramienta buscar_catalogo: el agente la usa para conocer el catálogo real.
// Hoy: búsqueda por palabras clave sobre los productos de la tienda (suficiente
// para catálogos chicos como Mamielina, ~70 piezas). Cuando haya VOYAGE_API_KEY
// y catálogos grandes, cambiar a búsqueda vectorial vía la RPC buscar_catalogo
// (pgvector, migración 0021) — misma firma de salida.

import { createServiceClient } from "@/lib/supabase/service";
import { urlFoto } from "@/lib/fotos";

export type ProductoAgente = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  existencia: number;
  disponible: boolean;
  genero: string | null;
  atributos: Record<string, string>;
  foto: string;
};

const sinAcentos = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export async function buscarCatalogo(
  tiendaId: string,
  consulta: string,
  opts: { limite?: number; soloDisponibles?: boolean } = {},
): Promise<ProductoAgente[]> {
  const limite = Math.min(Math.max(opts.limite ?? 6, 1), 12);
  const soloDisponibles = opts.soloDisponibles ?? true;
  const supabase = createServiceClient();

  const [{ data: prods }, { data: campos }] = await Promise.all([
    supabase
      .from("productos")
      .select(
        "id, nombre, descripcion, precio, precio_oferta, cantidad, estado, genero, fotos, atributos, linea_id",
      )
      .eq("tienda_id", tiendaId)
      .eq("oculto", false),
    supabase.from("campos_linea").select("id, nombre").eq("tienda_id", tiendaId),
  ]);

  const nombreCampo = new Map((campos ?? []).map((c) => [c.id, c.nombre]));

  let items: ProductoAgente[] = (prods ?? []).map((p) => {
    const atributos: Record<string, string> = {};
    for (const [k, v] of Object.entries(p.atributos ?? {})) {
      if (v == null || v === "") continue;
      atributos[nombreCampo.get(k) ?? k] = Array.isArray(v)
        ? v.join(", ")
        : String(v);
    }
    return {
      id: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: p.precio_oferta != null ? p.precio_oferta : p.precio,
      existencia: p.cantidad,
      disponible: p.estado === "disponible" && p.cantidad > 0,
      genero: p.genero,
      atributos,
      foto: (p.fotos ?? []).map(urlFoto).filter(Boolean)[0] ?? "",
    };
  });

  if (soloDisponibles) items = items.filter((p) => p.disponible);

  const tokens = sinAcentos(consulta || "")
    .split(/[^a-z0-9ñ]+/)
    .filter((t) => t.length >= 3);

  if (tokens.length) {
    const texto = (p: ProductoAgente) =>
      sinAcentos(
        [p.nombre, p.descripcion ?? "", p.genero ?? "", Object.values(p.atributos).join(" ")].join(" "),
      );
    items = items
      .map((p) => ({ p, score: tokens.reduce((n, t) => n + (texto(p).includes(t) ? 1 : 0), 0) }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.p)
      // si nada coincidió, igual devolvemos una muestra (mejor que vacío)
      .slice(0, limite);
  } else {
    items = items.slice(0, limite);
  }

  return items.slice(0, limite);
}
