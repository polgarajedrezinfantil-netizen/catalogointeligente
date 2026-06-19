import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getPerfil } from "@/lib/auth";
import { urlFoto } from "@/lib/fotos";

// Puntúa, con Claude visión, qué tan PARECIDO es cada resultado de precios a
// la foto real del producto del vendedor. El "parecido de la imagen" entra
// como variable del % de coincidencia que se muestra en cada resultado.
// Es best-effort: si algo falla, devuelve lista vacía y la UI degrada bien.

const MODELO = "claude-opus-4-8";

const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    coincidencias: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          indice: { type: "number" },
          coincidencia: { type: "number" }, // 0 a 1
        },
        required: ["indice", "coincidencia"],
      },
    },
  },
  required: ["coincidencias"],
} as const;

type Resultado = { titulo: string; thumbnail: string };

// Convierte una miniatura (URL http o data:base64) en un bloque de imagen.
function bloqueImagen(src: string): Anthropic.ContentBlockParam | null {
  if (!src) return null;
  if (src.startsWith("data:")) {
    const m = src.match(/^data:([^;]+);base64,(.*)$/);
    if (!m) return null;
    return {
      type: "image",
      source: { type: "base64", media_type: m[1] as "image/jpeg", data: m[2] },
    };
  }
  if (src.startsWith("http")) {
    return { type: "image", source: { type: "url", url: src } };
  }
  return null;
}

export async function POST(req: Request) {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { foto, producto, resultados } = (await req.json()) as {
    foto: string;
    producto?: string;
    resultados: Resultado[];
  };
  if (!foto || !resultados?.length) {
    return NextResponse.json({ coincidencias: [] });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Primero la foto del vendedor; luego cada resultado con su índice.
  const contenido: Anthropic.ContentBlockParam[] = [
    {
      type: "text",
      text:
        `Producto objetivo${producto ? `: ${producto}` : ""}.\n` +
        "La PRIMERA imagen es la foto real del producto del vendedor (la referencia).",
    },
    { type: "image", source: { type: "url", url: urlFoto(foto) } },
  ];

  const usados: number[] = [];
  resultados.slice(0, 8).forEach((r, i) => {
    const bloque = bloqueImagen(r.thumbnail);
    if (!bloque) return;
    contenido.push({ type: "text", text: `Resultado #${i}: ${r.titulo}` });
    contenido.push(bloque);
    usados.push(i);
  });

  if (usados.length === 0) {
    return NextResponse.json({ coincidencias: [] });
  }

  contenido.push({
    type: "text",
    text:
      "Para cada resultado, evalúa qué tan PARECIDO es visualmente a la foto del vendedor " +
      "(mismo modelo, color, estampado, forma) y qué tan bien coincide su título. " +
      "Devuelve 'coincidencia' de 0 a 1 por cada 'indice'. 1 = es claramente la misma pieza, " +
      "0 = no tiene nada que ver.",
  });

  try {
    const msg = await anthropic.messages.create({
      model: MODELO,
      max_tokens: 1024,
      output_config: { format: { type: "json_schema", schema: ESQUEMA } },
      messages: [{ role: "user", content: contenido }],
    });
    const bloque = msg.content.find((b) => b.type === "text");
    const data = JSON.parse(bloque && "text" in bloque ? bloque.text : "{}");
    return NextResponse.json(data);
  } catch {
    // Best-effort: no rompemos el flujo de precios.
    return NextResponse.json({ coincidencias: [] });
  }
}
