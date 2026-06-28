// Loop del agente: Claude (tool use) + herramientas buscar_catalogo y crear_link_pago.
// Manual loop: si el modelo pide una herramienta, la ejecutamos (catálogo real /
// cobro real) y le devolvemos el resultado, hasta que produzca su respuesta.

import Anthropic from "@anthropic-ai/sdk";
import { buscarCatalogo } from "./catalogo";
import { crearLinkPago } from "./pagos";
import { marcarEnHumano } from "./persistencia";
import type { MensajeChat } from "./persistencia";

const MODELO = "claude-opus-4-8";

const TOOL_BUSCAR: Anthropic.Tool = {
  name: "buscar_catalogo",
  description:
    "Busca productos REALES de la tienda por palabras clave (tipo de prenda, color, talla/edad, género, ocasión). Úsala SIEMPRE antes de mencionar productos, precios o existencia — nunca inventes. Devuelve hasta 6 productos con id, nombre, precio, existencia, disponibilidad, género y atributos.",
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

const TOOL_COBRAR: Anthropic.Tool = {
  name: "crear_link_pago",
  description:
    "Genera el LINK DE PAGO de Mercado Pago para cerrar la venta. Úsala SOLO cuando ya confirmaste con el cliente las piezas exactas (por sus id de buscar_catalogo), que están disponibles, y el cliente quiere pagar. Crea el pedido, reserva las prendas y devuelve la URL de pago. Si devuelve ok:false, NO afirmes que se pagó: explica el problema y ofrece alternativa o handoff. Nunca pidas datos de tarjeta por chat.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      producto_ids: {
        type: "array",
        items: { type: "string" },
        description: "Los id (de buscar_catalogo) de las piezas que el cliente confirmó comprar.",
      },
      cliente_nombre: {
        type: "string",
        description: "Nombre del cliente, si lo dio. Opcional.",
      },
      cliente_celular: {
        type: "string",
        description: "Celular del cliente (10 dígitos), si lo dio. Opcional; si no, se usa el del canal.",
      },
      cupon: {
        type: "string",
        description: "Palabra del cupón si el cliente tiene uno válido. Opcional.",
      },
    },
    required: ["producto_ids"],
  },
};

const TOOL_ESCALAR: Anthropic.Tool = {
  name: "escalar_humano",
  description:
    "Pasa la conversación a una persona del equipo (handoff). Úsala cuando: el cliente pide hablar con alguien; hay un reclamo o problema con un pedido ya pagado; pregunta algo fuera del catálogo/políticas y no tienes el dato; hay enojo real; o falló algo técnico (ej. el cobro). Tras llamarla, despídete con calidez avisando que en un momento lo atienden por aquí. No la uses para dudas normales que sí puedes resolver.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      motivo: {
        type: "string",
        description: "Motivo breve del escalamiento (para el equipo). Ej: 'reclamo de pedido pagado'.",
      },
    },
    required: ["motivo"],
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
  tiendaSlug: string;
  moneda: string;
  conversacionId: string;
  canal: string;
  clienteExternoId: string;
}): Promise<ResultadoAgente> {
  const {
    sistema,
    mensajes,
    tiendaId,
    tiendaSlug,
    moneda,
    conversacionId,
    canal,
    clienteExternoId,
  } = params;
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const messages: Anthropic.MessageParam[] = mensajes.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const usage = { input: 0, output: 0 };
  const herramientas: string[] = [];

  for (let i = 0; i < 6; i++) {
    const resp = await anthropic.messages.create({
      model: MODELO,
      max_tokens: 1024,
      system: sistema,
      tools: [TOOL_BUSCAR, TOOL_COBRAR, TOOL_ESCALAR],
      messages,
    });
    usage.input += resp.usage.input_tokens;
    usage.output += resp.usage.output_tokens;

    if (resp.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: resp.content });
      const resultados: Anthropic.ToolResultBlockParam[] = [];

      for (const block of resp.content) {
        if (block.type !== "tool_use") continue;

        if (block.name === "buscar_catalogo") {
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
        } else if (block.name === "crear_link_pago") {
          const input = block.input as {
            producto_ids?: string[];
            cliente_nombre?: string;
            cliente_celular?: string;
            cupon?: string;
          };
          herramientas.push(
            `crear_link_pago(${JSON.stringify(input.producto_ids ?? [])})`,
          );
          const cobro = await crearLinkPago({
            tiendaId,
            tiendaSlug,
            moneda,
            conversacionId,
            canal,
            clienteCelular: (input.cliente_celular || clienteExternoId).trim(),
            clienteNombre: input.cliente_nombre,
            productoIds: input.producto_ids ?? [],
            cupon: input.cupon,
          });
          resultados.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(cobro),
            is_error: !cobro.ok,
          });
        } else if (block.name === "escalar_humano") {
          const input = block.input as { motivo?: string };
          herramientas.push(`escalar_humano(${JSON.stringify(input.motivo ?? "")})`);
          await marcarEnHumano({
            conversacionId,
            tiendaId,
            motivo: input.motivo,
          });
          resultados.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify({ ok: true, en_humano: true }),
          });
        } else {
          resultados.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify({ ok: false, error: "herramienta_desconocida" }),
            is_error: true,
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
