// Persistencia del agente: tienda, conversación e historial de mensajes.
// Usa el SERVICE ROLE (el runtime no tiene sesión). Tablas: agente_* (migración 0020).

import { createServiceClient } from "@/lib/supabase/service";

export type TiendaAgente = {
  id: string;
  slug: string;
  nombre: string;
  etiqueta_precio: string;
  moneda: string;
};

export type RolMensaje = "cliente" | "agente" | "humano" | "sistema";

export async function obtenerTiendaPorSlug(
  slug: string,
): Promise<TiendaAgente | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("tiendas")
    .select("id, slug, nombre, etiqueta_precio, moneda")
    .eq("slug", slug)
    .eq("activa", true)
    .maybeSingle();
  return (data as TiendaAgente) ?? null;
}

export type EstadoConversacion = "abierta" | "en_humano" | "cerrada";

/**
 * Devuelve la conversación viva del cliente en ese canal (abierta o en manos de
 * un humano), o crea una nueva 'abierta'. Importante: NO ignora las 'en_humano',
 * para no abrir un hilo paralelo mientras una persona atiende (handoff).
 */
export async function cargarOCrearConversacion(params: {
  tiendaId: string;
  canal: string;
  clienteExternoId: string;
}): Promise<{ id: string; estado: EstadoConversacion }> {
  const supabase = createServiceClient();
  const { tiendaId, canal, clienteExternoId } = params;

  const { data: existente } = await supabase
    .from("agente_conversaciones")
    .select("id, estado")
    .eq("tienda_id", tiendaId)
    .eq("cliente_externo_id", clienteExternoId)
    .in("estado", ["abierta", "en_humano"])
    .order("ultimo_mensaje_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existente?.id) {
    return { id: existente.id as string, estado: existente.estado as EstadoConversacion };
  }

  const { data: creada, error } = await supabase
    .from("agente_conversaciones")
    .insert({
      tienda_id: tiendaId,
      tipo_canal: canal,
      cliente_externo_id: clienteExternoId,
      estado: "abierta",
    })
    .select("id")
    .single();

  if (error) throw new Error(`No se pudo crear la conversación: ${error.message}`);
  return { id: creada.id as string, estado: "abierta" };
}

/**
 * El agente escala a humano: marca la conversación 'en_humano' (para que aparezca
 * en la bandeja pidiendo atención) y deja una nota de sistema. La usa la
 * herramienta escalar_humano del loop.
 */
export async function marcarEnHumano(params: {
  conversacionId: string;
  tiendaId: string;
  motivo?: string;
}): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("agente_conversaciones")
    .update({ estado: "en_humano" })
    .eq("id", params.conversacionId)
    .eq("tienda_id", params.tiendaId);

  await guardarMensaje({
    conversacionId: params.conversacionId,
    tiendaId: params.tiendaId,
    rol: "sistema",
    contenido: `El agente escaló a atención humana${params.motivo ? `: ${params.motivo}` : "."}`,
  });
}

export type MensajeChat = { role: "user" | "assistant"; content: string };

/** Historial reciente como mensajes para Claude (cliente=user, agente/humano=assistant). */
export async function historialMensajes(
  conversacionId: string,
  limite = 20,
): Promise<MensajeChat[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("agente_mensajes")
    .select("rol, contenido, creado")
    .eq("conversacion_id", conversacionId)
    .order("creado", { ascending: true })
    .limit(limite);

  return (data ?? [])
    .filter((m) => m.contenido && (m.rol === "cliente" || m.rol === "agente" || m.rol === "humano"))
    .map((m) => ({
      role: m.rol === "cliente" ? ("user" as const) : ("assistant" as const),
      content: m.contenido as string,
    }));
}

export async function guardarMensaje(params: {
  conversacionId: string;
  tiendaId: string;
  rol: RolMensaje;
  contenido: string;
  externalId?: string; // id del mensaje en Meta (dedupe de entrantes)
  meta?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from("agente_mensajes").insert({
    conversacion_id: params.conversacionId,
    tienda_id: params.tiendaId,
    rol: params.rol,
    contenido: params.contenido,
    external_id: params.externalId ?? null,
    meta: params.meta ?? {},
  });
  await supabase
    .from("agente_conversaciones")
    .update({ ultimo_mensaje_en: new Date().toISOString() })
    .eq("id", params.conversacionId);
}

/** ¿Ya procesamos un mensaje entrante con este id de Meta? (idempotencia) */
export async function mensajeExisteExterno(externalId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("agente_mensajes")
    .select("id")
    .eq("external_id", externalId)
    .limit(1)
    .maybeSingle();
  return !!data;
}

/** Completa nombre/celular del cliente en la conversación si vienen del canal. */
export async function completarDatosCliente(params: {
  conversacionId: string;
  tiendaId: string;
  nombre?: string;
  celular?: string;
}): Promise<void> {
  const campos: Record<string, string> = {};
  if (params.nombre) campos.cliente_nombre = params.nombre;
  if (params.celular) campos.cliente_celular = params.celular;
  if (!Object.keys(campos).length) return;
  const supabase = createServiceClient();
  await supabase
    .from("agente_conversaciones")
    .update(campos)
    .eq("id", params.conversacionId)
    .eq("tienda_id", params.tiendaId);
}

/** Resuelve a qué tienda pertenece un canal de Meta (whatsapp/messenger/instagram). */
export async function resolverCanalATienda(
  tipo: "whatsapp" | "messenger" | "instagram",
  externalId: string,
): Promise<{ tiendaId: string; slug: string } | null> {
  const supabase = createServiceClient();
  const { data: canal } = await supabase
    .from("agente_canales")
    .select("tienda_id")
    .eq("tipo", tipo)
    .eq("external_id", externalId)
    .eq("activo", true)
    .maybeSingle();
  if (!canal?.tienda_id) return null;

  const { data: tienda } = await supabase
    .from("tiendas")
    .select("slug")
    .eq("id", canal.tienda_id)
    .eq("activa", true)
    .maybeSingle();
  if (!tienda?.slug) return null;

  return { tiendaId: canal.tienda_id as string, slug: tienda.slug as string };
}
