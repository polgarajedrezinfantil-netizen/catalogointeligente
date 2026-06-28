// Embeddings con Voyage AI (recomendado por Anthropic; Anthropic no tiene API de
// embeddings). Modelo voyage-3.5 → 1024 dimensiones, que es justo el vector(1024)
// de la tabla producto_embeddings y de la RPC buscar_catalogo (migración 0021).
//
// Si no hay VOYAGE_API_KEY, embeddingsActivos() devuelve false y el agente cae a
// la búsqueda por palabras clave (no se rompe nada).

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const MODELO_EMB = "voyage-3.5";
const DIMENSION = 1024;

/** ¿Está configurada la búsqueda vectorial? */
export function embeddingsActivos(): boolean {
  return !!process.env.VOYAGE_API_KEY;
}

/**
 * Embebe una lista de textos. input_type:
 *   - "document" al indexar el catálogo
 *   - "query"    al buscar (Voyage optimiza cada caso)
 * Devuelve un arreglo de vectores en el MISMO orden que la entrada.
 */
export async function embed(
  textos: string[],
  inputType: "query" | "document",
): Promise<number[][]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error("VOYAGE_API_KEY no configurada");
  if (!textos.length) return [];

  const resp = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: textos,
      model: MODELO_EMB,
      input_type: inputType,
      output_dimension: DIMENSION,
    }),
  });

  if (!resp.ok) {
    const detalle = await resp.text();
    throw new Error(`voyage ${resp.status}: ${detalle.slice(0, 200)}`);
  }

  const data = (await resp.json()) as {
    data: { embedding: number[]; index: number }[];
  };
  // Voyage puede devolver desordenado: reordena por index.
  return data.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

/** Embebe una sola consulta y devuelve su vector. */
export async function embedQuery(texto: string): Promise<number[]> {
  const [v] = await embed([texto], "query");
  return v;
}

/**
 * pgvector espera el vector como texto "[v1,v2,…]" (lo mismo que JSON.stringify
 * de un arreglo). Necesario al mandar vectores por PostgREST/RPC de supabase-js.
 */
export function vectorLiteral(vec: number[]): string {
  return JSON.stringify(vec);
}

export { DIMENSION, MODELO_EMB };
