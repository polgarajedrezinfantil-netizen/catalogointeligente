// Sincroniza el catálogo de una tienda → tabla producto_embeddings.
// Incremental: solo (re)embebe productos nuevos o cuyo texto cambió, y borra los
// embeddings de productos que ya no existen u ocultos. Usa la SERVICE ROLE.

import { createServiceClient } from "@/lib/supabase/service";
import { embed, embeddingsActivos, vectorLiteral } from "./embeddings";

type ProdRow = {
  id: string;
  nombre: string | null;
  descripcion: string | null;
  genero: string | null;
  atributos: Record<string, unknown> | null;
  linea_id: string | null;
};

export type ResultadoSync = {
  total: number;
  embebidos: number;
  sin_cambios: number;
  borrados: number;
};

/** Construye el texto que representa al producto (lo que se embebe). */
function contenidoDe(
  p: ProdRow,
  nombreCampo: Map<string, string>,
  nombreLinea: Map<string, string>,
): string {
  const attrs: string[] = [];
  for (const [k, v] of Object.entries(p.atributos ?? {})) {
    if (v == null || v === "") continue;
    const val = Array.isArray(v) ? v.join(", ") : String(v);
    attrs.push(`${nombreCampo.get(k) ?? k}: ${val}`);
  }
  return [
    p.nombre ?? "",
    p.linea_id ? nombreLinea.get(p.linea_id) ?? "" : "",
    p.genero ?? "",
    p.descripcion ?? "",
    attrs.join(" · "),
  ]
    .filter(Boolean)
    .join(". ")
    .trim();
}

function lotes<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export async function sincronizarEmbeddings(tiendaId: string): Promise<ResultadoSync> {
  if (!embeddingsActivos()) {
    throw new Error("VOYAGE_API_KEY no configurada: no se puede indexar el catálogo.");
  }
  const supabase = createServiceClient();

  const [{ data: prods }, { data: campos }, { data: lineas }, { data: existentes }] =
    await Promise.all([
      supabase
        .from("productos")
        .select("id, nombre, descripcion, genero, atributos, linea_id")
        .eq("tienda_id", tiendaId)
        .eq("oculto", false),
      supabase.from("campos_linea").select("id, nombre").eq("tienda_id", tiendaId),
      supabase.from("lineas").select("id, nombre").eq("tienda_id", tiendaId),
      supabase
        .from("producto_embeddings")
        .select("producto_id, contenido")
        .eq("tienda_id", tiendaId),
    ]);

  const nombreCampo = new Map((campos ?? []).map((c) => [c.id as string, c.nombre as string]));
  const nombreLinea = new Map((lineas ?? []).map((l) => [l.id as string, l.nombre as string]));
  const prev = new Map((existentes ?? []).map((e) => [e.producto_id as string, e.contenido as string]));

  const productos = (prods ?? []) as ProdRow[];
  const vivos = new Set(productos.map((p) => p.id));

  // Nuevos o con texto cambiado.
  const aEmbed = productos
    .map((p) => ({ id: p.id, contenido: contenidoDe(p, nombreCampo, nombreLinea) }))
    .filter((x) => x.contenido && prev.get(x.id) !== x.contenido);

  // Embeddings huérfanos (producto borrado u oculto).
  const huerfanos = [...prev.keys()].filter((id) => !vivos.has(id));
  if (huerfanos.length) {
    await supabase.from("producto_embeddings").delete().in("producto_id", huerfanos);
  }

  let embebidos = 0;
  for (const lote of lotes(aEmbed, 100)) {
    const vecs = await embed(lote.map((x) => x.contenido), "document");
    const filas = lote.map((x, i) => ({
      producto_id: x.id,
      tienda_id: tiendaId,
      contenido: x.contenido,
      embedding: vectorLiteral(vecs[i]),
      actualizado: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from("producto_embeddings")
      .upsert(filas, { onConflict: "producto_id" });
    if (error) throw new Error(`upsert embeddings: ${error.message}`);
    embebidos += filas.length;
  }

  return {
    total: productos.length,
    embebidos,
    sin_cambios: productos.length - aEmbed.length,
    borrados: huerfanos.length,
  };
}
