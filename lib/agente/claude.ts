// Loop del agente: Claude (tool use) + herramienta buscar_catalogo.
// Manual loop: si el modelo pide la herramienta, la ejecutamos contra el
// catálogo real y le devolvemos el resultado, hasta que produzca su respuesta.

import Anthropic from "@anthropic-ai/sdk";
import { buscarCatalogo } from "./catalogo";
import type { MensajeChat } from "./persistencia";

const MODELO = "claude-opus-4-8";

const TOOL_BUSCAR: Anthropic.Tool = {
  name: "buscar_catalogo",
  description:
    "Busca productos REALES de la tienda por palabras clave (tipo de prenda, color, talla/edad, género, ocasión). Úsala SIEMPRE antes de mencionar productos, precios o existencia — nunca inventes. Devuelve hasta 6 productos con nombre, precio, existencia, disponibilidad, género y atributos.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      consulta: {
        type: "string",
        description: "Lo que busca el cliente, en palabras. Ej: 'vestido niña 3 años fiesta'.",
      },
      solo_disponibles: {
        type: "boolean",
        description: "Si true, solo trae piezas en existencia (default true).",
      },
    },
    required: ["consulta"],
  },
};

export type ResultadoAgente = {
  texto: string;
  usage: { input: number; output: number };
  herramientas: string[];
};

export async function correrAgente(params: {
  sistema: string;
  mensajes: MensajeChat[];
  tiendaId: string;
}): Promise<ResultadoAgente> {
  const { sistema, mensajes, tiendaId } = params;
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const messages: Anthropic.MessageParam[] = mensajes.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const usage = { input: 0, output: 0 };
  const herramientas: string[] = [];

  for (let i = 0; i < 5; i++) {
    const resp = await anthropic.messages.create({
      model: MODELO,
      max_tokens: 1024,
      system: sistema,
      tools: [TOOL_BUSCAR],
      messages,
    });
    usage.input += resp.usage.input_tokens;
    usage.output += resp.usage.output_tokens;

    if (resp.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: resp.content });
      const resultados: Anthropic.ToolResultBlockParam[] = [];
      for (const block of resp.content) {
        if (block.type === "tool_use" && block.name === "buscar_catalogo") {
          const input = block.input as { consulta?: string; solo_disponibles?: boolean };
          herramientas.push(`buscar_catalogo(${JSON.stringify(input.consulta ?? "")})`);
          const productos = await buscarCatalogo(tiendaId, input.consulta ?? "", {
            soloDisponibles: input.solo_disponibles,
          });
          resultados.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(productos),
          });
        }
      }
      messages.push({ role: "user", content: resultados });
      continue;
    }

    const texto = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return { texto, usage, herramientas };
  }

  return {
    texto: "Déjame confirmarlo con el equipo y te escribo en un momento 🙌",
    usage,
    herramientas,
  };
}
