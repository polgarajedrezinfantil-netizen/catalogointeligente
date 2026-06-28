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

/** Devuelve la conversación 'abierta' del cliente en ese canal, o crea una. */
export async function cargarOCrearConversacion(params: {
  tiendaId: string;
  canal: string;
  clienteExternoId: string;
}): Promise<string> {
  const supabase = createServiceClient();
  const { tiendaId, canal, clienteExternoId } = params;

  const { data: existente } = await supabase
    .from("agente_conversaciones")
    .select("id")
    .eq("tienda_id", tiendaId)
    .eq("cliente_externo_id", clienteExternoId)
    .eq("estado", "abierta")
    .order("ultimo_mensaje_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existente?.id) return existente.id as string;

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
  return creada.id as string;
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
  meta?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from("agente_mensajes").insert({
    conversacion_id: params.conversacionId,
    tienda_id: params.tiendaId,
    rol: params.rol,
    contenido: params.contenido,
    meta: params.meta ?? {},
  });
  await supabase
    .from("agente_conversaciones")
    .update({ ultimo_mensaje_en: new Date().toISOString() })
    .eq("id", params.conversacionId);
}
