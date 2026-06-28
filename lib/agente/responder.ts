// Orquestador del agente, agnóstico de canal. Lo llaman por igual la simulación
// y (en el futuro) el webhook de WhatsApp/Messenger/Instagram.

import { configTenant } from "./tenants";
import { construirSistema } from "./core";
import { correrAgente } from "./claude";
import {
  obtenerTiendaPorSlug,
  cargarOCrearConversacion,
  historialMensajes,
  guardarMensaje,
} from "./persistencia";

export type RespuestaAgente = {
  conversacionId: string;
  texto: string;
  herramientas: string[];
  usage: { input: number; output: number };
};

export async function responder(params: {
  tiendaSlug: string;
  canal: string; // 'simulacion' | 'whatsapp' | 'messenger' | 'instagram'
  clienteExternoId: string;
  texto: string;
}): Promise<RespuestaAgente> {
  const { tiendaSlug, canal, clienteExternoId, texto } = params;

  const tienda = await obtenerTiendaPorSlug(tiendaSlug);
  if (!tienda) throw new Error(`Tienda no encontrada o inactiva: ${tiendaSlug}`);

  const cfg = configTenant(tiendaSlug);
  if (!cfg) throw new Error(`La tienda ${tiendaSlug} no tiene config de agente`);

  const conversacionId = await cargarOCrearConversacion({
    tiendaId: tienda.id,
    canal,
    clienteExternoId,
  });

  // Guarda el mensaje entrante, luego carga el historial (que ya lo incluye).
  await guardarMensaje({
    conversacionId,
    tiendaId: tienda.id,
    rol: "cliente",
    contenido: texto,
  });

  const mensajes = await historialMensajes(conversacionId);
  const sistema = construirSistema(cfg);

  const r = await correrAgente({ sistema, mensajes, tiendaId: tienda.id });

  await guardarMensaje({
    conversacionId,
    tiendaId: tienda.id,
    rol: "agente",
    contenido: r.texto,
    meta: { modelo: "claude-opus-4-8", usage: r.usage, herramientas: r.herramientas },
  });

  return { conversacionId, texto: r.texto, herramientas: r.herramientas, usage: r.usage };
}
