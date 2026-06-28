// Herramienta buscar_catalogo: el agente la usa para conocer el catálogo real.
//
// Dos motores, misma salida (ProductoAgente):
//   1) VECTORIAL (semántico) cuando hay VOYAGE_API_KEY: embebe la consulta con
//      Voyage y usa la RPC buscar_catalogo (pgvector, migración 0021). Entiende
//      intención ("algo para una niña de 3 años para fiesta").
//   2) KEYWORD (palabras clave) como respaldo: suficiente para catálogos chicos
//      (~70 piezas) y siempre disponible. También es el fallback si el vectorial
//      falla, para que el agente nunca se quede sin catálogo.

import { createServiceClient } from "@/lib/supabase/service";
import { urlFoto } from "@/lib/fotos";
import { embeddingsActivos, embedQuery, vectorLiteral } from "./embeddings";

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

/** Trae nombre→valor de atributos legibles para un conjunto de productos. */
async function atributosDe(
  supabase: ReturnType<typeof createServiceClient>,
  tiendaId: string,
  ids: string[],
): Promise<Map<string, Record<string, string>>> {
  if (!ids.length) return new Map();
  const [{ data: prods }, { data: campos }] = await Promise.all([
    supabase.from("productos").select("id, atributos").in("id", ids),
    supabase.from("campos_linea").select("id, nombre").eq("tienda_id", tiendaId),
  ]);
  const nombreCampo = new Map((campos ?? []).map((c) => [c.id, c.nombre]));
  const out = new Map<string, Record<string, string>>();
  for (const p of prods ?? []) {
    const attrs: Record<string, string> = {};
    for (const [k, v] of Object.entries(p.atributos ?? {})) {
      if (v == null || v === "") continue;
      attrs[nombreCampo.get(k) ?? k] = Array.isArray(v) ? v.join(", ") : String(v);
    }
    out.set(p.id as string, attrs);
  }
  return out;
}

/** Motor VECTORIAL: embedding de la consulta → RPC pgvector → ProductoAgente[]. */
async function buscarVectorial(
  tiendaId: string,
  consulta: string,
  limite: number,
  soloDisponibles: boolean,
): Promise<ProductoAgente[]> {
  const supabase = createServiceClient();
  const vec = await embedQuery(consulta);

  const { data, error } = await supabase.rpc("buscar_catalogo", {
    p_tienda_id: tiendaId,
    p_embedding: vectorLiteral(vec),
    p_limite: limite,
    p_solo_disponibles: soloDisponibles,
  });
  if (error) throw new Error(`rpc buscar_catalogo: ${error.message}`);

  const filas = (data ?? []) as {
    producto_id: string;
    nombre: string;
    descripcion: string | null;
    precio: number;
    existencia: number;
    disponible: boolean;
    genero: string | null;
    fotos: string[] | null;
  }[];

  const attrs = await atributosDe(supabase, tiendaId, filas.map((f) => f.producto_id));

  return filas.map((f) => ({
    id: f.producto_id,
    nombre: f.nombre,
    descripcion: f.descripcion,
    precio: f.precio,
    existencia: f.existencia,
    disponible: f.disponible,
    genero: f.genero,
    atributos: attrs.get(f.producto_id) ?? {},
    foto: (f.fotos ?? []).map(urlFoto).filter(Boolean)[0] ?? "",
  }));
}

/** Motor KEYWORD: lee el catálogo y puntúa por coincidencia de palabras. */
async function buscarPorKeyword(
  tiendaId: string,
  consulta: string,
  limite: number,
  soloDisponibles: boolean,
): Promise<ProductoAgente[]> {
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
      atributos[nombreCampo.get(k) ?? k] = Array.isArray(v) ? v.join(", ") : String(v);
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
      .slice(0, limite);
  } else {
    items = items.slice(0, limite);
  }

  return items.slice(0, limite);
}

export async function buscarCatalogo(
  tiendaId: string,
  consulta: string,
  opts: { limite?: number; soloDisponibles?: boolean } = {},
): Promise<ProductoAgente[]> {
  const limite = Math.min(Math.max(opts.limite ?? 6, 1), 12);
  const soloDisponibles = opts.soloDisponibles ?? true;

  if (embeddingsActivos()) {
    try {
      return await buscarVectorial(tiendaId, consulta, limite, soloDisponibles);
    } catch (e) {
      // Nunca dejamos al agente sin catálogo: caemos a keyword.
      console.error("[agente] búsqueda vectorial falló, uso keyword:", e);
    }
  }
  return buscarPorKeyword(tiendaId, consulta, limite, soloDisponibles);
}
