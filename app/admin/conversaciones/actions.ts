"use server";

import { revalidatePath } from "next/cache";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Acciones de la bandeja. Corren con el cliente de SESIÓN: RLS garantiza que el
// admin/delegado solo toca conversaciones de SU tienda (tienda_id = mi_tienda_id()).

async function ctx() {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) throw new Error("No autorizado");
  const supabase = await createClient();
  return { perfil, supabase, tienda: perfil.tienda_id };
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
  const { perfil, supabase, tienda } = await ctx();
  const id = String(formData.get("conversacion_id"));
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
  const { perfil, supabase, tienda } = await ctx();
  const id = String(formData.get("conversacion_id"));
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
  const { perfil, supabase, tienda } = await ctx();
  const id = String(formData.get("conversacion_id"));
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
  const { supabase, tienda } = await ctx();
  const id = String(formData.get("conversacion_id"));
  const texto = String(formData.get("texto") ?? "").trim();
  if (!texto) return;
  await nota(supabase, tienda, id, "humano", texto);
  refresca(id);
}
