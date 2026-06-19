import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getPerfil } from "@/lib/auth";
import { urlFoto } from "@/lib/fotos";

// Identificación de mercancía con Claude (visión) + compuerta de confianza.
// Devuelve candidatos con su certeza, o preguntas de desambiguación si la
// foto no basta. NO afirma 98% automático: la confirmación final es humana.

const MODELO = "claude-opus-4-8"; // visión + salida estructurada

// Esquema JSON que el modelo debe devolver (structured outputs).
const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    necesita_mas: { type: "boolean" },
    confianza: { type: "number" }, // 0 a 1
    preguntas: { type: "array", items: { type: "string" } },
    candidatos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          nombre: { type: "string" },
          marca: { type: "string" },
          modelo: { type: "string" },
          certeza: { type: "number" }, // 0 a 1
          resumen: { type: "string" },
          terminos_busqueda: { type: "string" },
        },
        required: [
          "nombre",
          "marca",
          "modelo",
          "certeza",
          "resumen",
          "terminos_busqueda",
        ],
      },
    },
  },
  required: ["necesita_mas", "confianza", "preguntas", "candidatos"],
} as const;

const SISTEMA = `Eres un experto en identificar productos NUEVOS de retail a partir de fotografías, para una tienda que revende mercancía.
Tu objetivo es identificar la PIEZA EXACTA con la mayor certeza posible: marca, modelo y nombre comercial.
Reglas:
- Si la(s) foto(s) no bastan para una identificación segura (≈0.9+), pon necesita_mas=true y genera 2-4 preguntas concretas que aumenten la certeza (pedir foto de la etiqueta, código de barras, número de serie, modelo impreso, tamaño, etc.).
- Nunca inventes un modelo. Si no es legible, dilo en el resumen y baja la certeza.
- "terminos_busqueda" debe ser una consulta corta y precisa para buscar el precio real en tiendas (marca + modelo + característica clave).
- Devuelve hasta 3 candidatos ordenados por certeza (mayor primero).
- "confianza" es tu certeza global de la mejor coincidencia (0 a 1).
Responde SOLO con el JSON del esquema.`;

export async function POST(req: Request) {
  // Solo admins/delegados de una tienda.
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { fotos, respuestas } = (await req.json()) as {
    fotos: string[];
    respuestas?: { pregunta: string; respuesta: string }[];
  };
  if (!fotos?.length) {
    return NextResponse.json({ error: "Faltan fotos" }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Bloques de imagen (URLs públicas del Storage) + instrucción.
  const contenido: Anthropic.ContentBlockParam[] = fotos
    .slice(0, 6)
    .map((p) => ({
      type: "image" as const,
      source: { type: "url" as const, url: urlFoto(p) },
    }));

  let texto = "Identifica el producto de estas fotos.";
  if (respuestas?.length) {
    texto +=
      "\n\nDatos adicionales que dio el vendedor:\n" +
      respuestas.map((r) => `- ${r.pregunta}: ${r.respuesta}`).join("\n");
  }
  contenido.push({ type: "text", text: texto });

  try {
    const msg = await anthropic.messages.create({
      model: MODELO,
      max_tokens: 2048,
      system: SISTEMA,
      output_config: { format: { type: "json_schema", schema: ESQUEMA } },
      messages: [{ role: "user", content: contenido }],
    });

    const bloque = msg.content.find((b) => b.type === "text");
    const data = JSON.parse(bloque && "text" in bloque ? bloque.text : "{}");
    return NextResponse.json(data);
  } catch (e) {
    const detalle = e instanceof Error ? e.message : "Error de IA";
    return NextResponse.json({ error: detalle }, { status: 500 });
  }
}
