"use server";

import { revalidatePath } from "next/cache";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Acciones de la bandeja. Corren con el cliente de SESIÓN: la RLS garantiza que
// el admin/delegado solo toca conversaciones de SU tienda, y el superadmin las
// de cualquiera (políticas agente_conv_super / agente_msg_super).

async function ctx() {
  const perfil = await getPerfil();
  const esSuper = perfil?.rol === "superadmin";
  if (!perfil || (!esSuper && !perfil.tienda_id)) throw new Error("No autorizado");
  const supabase = await createClient();
  return { perfil, supabase, esSuper };
}

// Tienda de la conversación. La RLS ya acota (admin solo la suya; superadmin
// cualquiera), pero para el admin agregamos un filtro EXPLÍCITO por su tienda
// como defensa en profundidad (no depender 100% de RLS). Si no la puede ver, la
// consulta no devuelve fila y lanzamos.
async function tiendaDeConv(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  restringirA: string | null,
): Promise<string> {
  let q = supabase.from("agente_conversaciones").select("tienda_id").eq("id", id);
  if (restringirA) q = q.eq("tienda_id", restringirA);
  const { data } = await q.maybeSingle();
  if (!data?.tienda_id) throw new Error("Conversación no encontrada");
  return data.tienda_id as string;
}

async function nota(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tienda: string,
  conversacionId: string,
  rol: "sistema" | "humano",
  contenido: string,
) {
  await supabase.from("agente_mensajes").insert({
    conversacion_id: conversacionId,
    tienda_id: tienda,
    rol,
    contenido,
  });
  await supabase
    .from("agente_conversaciones")
    .update({ ultimo_mensaje_en: new Date().toISOString() })
    .eq("id", conversacionId)
    .eq("tienda_id", tienda);
}

function refresca(id: string) {
  revalidatePath("/admin/conversaciones");
  revalidatePath(`/admin/conversaciones/${id}`);
}

/** El humano toma el control: el agente deja de responder. */
export async function tomarControl(formData: FormData) {
  const { perfil, supabase, esSuper } = await ctx();
  const id = String(formData.get("conversacion_id"));
  const tienda = await tiendaDeConv(supabase, id, esSuper ? null : perfil.tienda_id);
  const { error } = await supabase
    .from("agente_conversaciones")
    .update({ estado: "en_humano", asignado_a: perfil.id })
    .eq("id", id)
    .eq("tienda_id", tienda);
  if (error) throw new Error(error.message);
  await nota(supabase, tienda, id, "sistema", `${perfil.nombre} tomó la conversación.`);
  refresca(id);
}

/** Devuelve la conversación al agente. */
export async function devolverAlAgente(formData: FormData) {
  const { perfil, supabase, esSuper } = await ctx();
  const id = String(formData.get("conversacion_id"));
  const tienda = await tiendaDeConv(supabase, id, esSuper ? null : perfil.tienda_id);
  const { error } = await supabase
    .from("agente_conversaciones")
    .update({ estado: "abierta", asignado_a: null })
    .eq("id", id)
    .eq("tienda_id", tienda);
  if (error) throw new Error(error.message);
  await nota(supabase, tienda, id, "sistema", `${perfil.nombre} devolvió la conversación al agente.`);
  refresca(id);
}

/** Cierra la conversación. */
export async function cerrarConversacion(formData: FormData) {
  const { perfil, supabase, esSuper } = await ctx();
  const id = String(formData.get("conversacion_id"));
  const tienda = await tiendaDeConv(supabase, id, esSuper ? null : perfil.tienda_id);
  const { error } = await supabase
    .from("agente_conversaciones")
    .update({ estado: "cerrada" })
    .eq("id", id)
    .eq("tienda_id", tienda);
  if (error) throw new Error(error.message);
  await nota(supabase, tienda, id, "sistema", `${perfil.nombre} cerró la conversación.`);
  refresca(id);
}

/**
 * Responde como humano. Hoy queda registrado en el hilo (lo ve el equipo y el
 * cliente cuando el canal esté conectado). El ENVÍO al cliente por WhatsApp/IG/FB
 * se conecta en la fase del webhook de canal.
 */
export async function responderHumano(formData: FormData) {
  const { perfil, supabase, esSuper } = await ctx();
  const id = String(formData.get("conversacion_id"));
  const texto = String(formData.get("texto") ?? "").trim();
  if (!texto) return;
  const tienda = await tiendaDeConv(supabase, id, esSuper ? null : perfil.tienda_id);
  await nota(supabase, tienda, id, "humano", texto);
  refresca(id);
}
