// Orquestador del agente, agnóstico de canal. Lo llaman por igual la simulación
// y (en el futuro) el webhook de WhatsApp/Messenger/Instagram.

import { cargarConfigTenant } from "./tenants";
import { construirSistema } from "./core";
import { correrAgente } from "./claude";
import {
  obtenerTiendaPorSlug,
  cargarOCrearConversacion,
  historialMensajes,
  guardarMensaje,
  completarDatosCliente,
  type EstadoConversacion,
} from "./persistencia";

export type RespuestaAgente = {
  conversacionId: string;
  estado: EstadoConversacion;
  atendidoPorAgente: boolean;
  texto: string;
  herramientas: string[];
  usage: { input: number; output: number };
};

export async function responder(params: {
  tiendaSlug: string;
  canal: string; // 'simulacion' | 'whatsapp' | 'messenger' | 'instagram'
  clienteExternoId: string;
  texto: string;
  externalId?: string;     // id del mensaje en Meta (dedupe)
  clienteNombre?: string;  // nombre del perfil del canal
  clienteCelular?: string; // teléfono del cliente (wa_id)
}): Promise<RespuestaAgente> {
  const { tiendaSlug, canal, clienteExternoId, texto, externalId, clienteNombre, clienteCelular } = params;

  const tienda = await obtenerTiendaPorSlug(tiendaSlug);
  if (!tienda) throw new Error(`Tienda no encontrada o inactiva: ${tiendaSlug}`);

  const cfg = await cargarConfigTenant(tienda.id, tienda.slug);
  if (!cfg) throw new Error(`La tienda ${tiendaSlug} no tiene config de agente`);

  const conv = await cargarOCrearConversacion({
    tiendaId: tienda.id,
    canal,
    clienteExternoId,
  });

  if (clienteNombre || clienteCelular) {
    await completarDatosCliente({
      conversacionId: conv.id,
      tiendaId: tienda.id,
      nombre: clienteNombre,
      celular: clienteCelular,
    });
  }

  // Siempre registramos lo que escribe el cliente (lo verá el humano en la bandeja).
  await guardarMensaje({
    conversacionId: conv.id,
    tiendaId: tienda.id,
    rol: "cliente",
    contenido: texto,
    externalId,
  });

  // El agente NO responde si la tienda no está activa (alta a medio configurar),
  // o si una persona tomó la conversación / está cerrada (handoff).
  if (!cfg.activa || conv.estado !== "abierta") {
    return {
      conversacionId: conv.id,
      estado: conv.estado,
      atendidoPorAgente: false,
      texto: "",
      herramientas: [],
      usage: { input: 0, output: 0 },
    };
  }

  const mensajes = await historialMensajes(conv.id);
  const sistema = construirSistema(cfg);

  const r = await correrAgente({
    sistema,
    mensajes,
    tiendaId: tienda.id,
    tiendaSlug: tienda.slug,
    moneda: tienda.moneda,
    conversacionId: conv.id,
    canal,
    clienteExternoId,
  });

  await guardarMensaje({
    conversacionId: conv.id,
    tiendaId: tienda.id,
    rol: "agente",
    contenido: r.texto,
    meta: { modelo: "claude-opus-4-8", usage: r.usage, herramientas: r.herramientas },
  });

  // El agente pudo haber escalado a humano durante el turno.
  const escalo = r.herramientas.some((h) => h.startsWith("escalar_humano"));

  return {
    conversacionId: conv.id,
    estado: escalo ? "en_humano" : "abierta",
    atendidoPorAgente: true,
    texto: r.texto,
    herramientas: r.herramientas,
    usage: r.usage,
  };
}
