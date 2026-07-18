"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { enviarReciboPago } from "@/lib/agente/recibo";

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

// Evita open-redirects: solo dentro de la bandeja.
function destinoSeguro(volver: FormDataEntryValue | null): string {
  const v = typeof volver === "string" ? volver : "";
  return v.startsWith("/admin/conversaciones") ? v : "/admin/conversaciones";
}

/** Archiva: la oculta de la bandeja (reversible). */
export async function archivarConversacion(formData: FormData) {
  const { perfil, supabase, esSuper } = await ctx();
  const id = String(formData.get("conversacion_id"));
  const destino = destinoSeguro(formData.get("volver"));
  const tienda = await tiendaDeConv(supabase, id, esSuper ? null : perfil.tienda_id);
  const { error } = await supabase
    .from("agente_conversaciones")
    .update({ archivada: true })
    .eq("id", id)
    .eq("tienda_id", tienda);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/conversaciones");
  redirect(destino);
}

/** Desarchiva: la regresa a la bandeja activa. */
export async function desarchivarConversacion(formData: FormData) {
  const { perfil, supabase, esSuper } = await ctx();
  const id = String(formData.get("conversacion_id"));
  const destino = destinoSeguro(formData.get("volver"));
  const tienda = await tiendaDeConv(supabase, id, esSuper ? null : perfil.tienda_id);
  const { error } = await supabase
    .from("agente_conversaciones")
    .update({ archivada: false })
    .eq("id", id)
    .eq("tienda_id", tienda);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/conversaciones");
  redirect(destino);
}

/** Borra la conversación y sus mensajes (FK on delete cascade). Definitivo. */
export async function eliminarConversacion(formData: FormData) {
  const { perfil, supabase, esSuper } = await ctx();
  const id = String(formData.get("conversacion_id"));
  const destino = destinoSeguro(formData.get("volver"));
  const tienda = await tiendaDeConv(supabase, id, esSuper ? null : perfil.tienda_id);
  const { error } = await supabase
    .from("agente_conversaciones")
    .delete()
    .eq("id", id)
    .eq("tienda_id", tienda);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/conversaciones");
  redirect(destino);
}

export type ResultadoComprobante = {
  ok: boolean;
  estado?: "aprobado" | "rechazado";
  nota?: { id: string; rol: "sistema"; contenido: string; creado: string };
  pedido?: { folio: number; total: number } | null;
  error?: string;
};

/**
 * Aprueba o rechaza un comprobante de pago (imagen del cliente).
 * Al APROBAR, además marca como PAGADO el pedido pendiente ligado a la
 * conversación (si existe) con pagar_pedido_agente. Deja nota en el hilo.
 * Autoriza con la sesión (getPerfil) y escribe con la service role (la RPC de
 * cobro es security definer / service_role), acotando por tienda a mano.
 */
export async function decidirComprobante(
  mensajeId: string,
  decision: "aprobado" | "rechazado",
  correo?: string,
): Promise<ResultadoComprobante> {
  const perfil = await getPerfil();
  const esSuper = perfil?.rol === "superadmin";
  if (!perfil || (!esSuper && !perfil.tienda_id)) return { ok: false, error: "no_autorizado" };
  if (decision !== "aprobado" && decision !== "rechazado") return { ok: false, error: "decision_invalida" };

  const svc = createServiceClient();

  const { data: msg } = await svc
    .from("agente_mensajes")
    .select("id, tienda_id, conversacion_id, meta")
    .eq("id", mensajeId)
    .maybeSingle();
  if (!msg) return { ok: false, error: "mensaje_no_encontrado" };

  const tienda = msg.tienda_id as string;
  const conversacionId = msg.conversacion_id as string;
  if (!esSuper && tienda !== perfil.tienda_id) return { ok: false, error: "no_autorizado" };

  // Marca el comprobante en el mensaje.
  const metaActual = (msg.meta ?? {}) as Record<string, unknown>;
  await svc
    .from("agente_mensajes")
    .update({ meta: { ...metaActual, comprobante: true, comprobante_estado: decision } })
    .eq("id", mensajeId)
    .eq("tienda_id", tienda);

  // Al aprobar: marca pagado el pedido pendiente ligado a la conversación y, si
  // dieron un correo, manda el recibo.
  let pedidoInfo: { folio: number; total: number } | null = null;
  let reciboA: string | null = null;
  const correoLimpio = (correo ?? "").trim();
  const correoValido = /.+@.+\..+/.test(correoLimpio);
  if (decision === "aprobado") {
    const { data: ventas } = await svc
      .from("agente_ventas")
      .select("pedido_id, creado")
      .eq("conversacion_id", conversacionId)
      .not("pedido_id", "is", null)
      .order("creado", { ascending: false });
    const pedidoIds = (ventas ?? []).map((v) => v.pedido_id as string).filter(Boolean);
    if (pedidoIds.length) {
      const { data: peds } = await svc
        .from("pedidos")
        .select("id, folio, total, estado")
        .in("id", pedidoIds)
        .eq("estado", "pendiente")
        .order("folio", { ascending: false })
        .limit(1);
      const ped = peds?.[0];
      if (ped?.id) {
        const { data: res } = await svc.rpc("pagar_pedido_agente", { p_pedido: ped.id as string });
        if ((res as { ok?: boolean } | null)?.ok) {
          pedidoInfo = { folio: ped.folio as number, total: Number(ped.total) };
        }
        // Recibo por correo (best-effort; requiere Resend configurado).
        if (correoValido) {
          await enviarReciboPago(ped.id as string, correoLimpio);
          reciboA = correoLimpio;
        }
      }
    }
  }

  const contenido =
    decision === "rechazado"
      ? `❌ Comprobante rechazado por ${perfil.nombre}.`
      : pedidoInfo
        ? `✅ Comprobante aprobado por ${perfil.nombre}. Pedido #${pedidoInfo.folio} marcado como PAGADO.${
            reciboA ? ` Recibo enviado a ${reciboA}.` : ""
          }`
        : `✅ Comprobante aprobado por ${perfil.nombre}.`;

  const { data: nota } = await svc
    .from("agente_mensajes")
    .insert({ conversacion_id: conversacionId, tienda_id: tienda, rol: "sistema", contenido })
    .select("id, rol, contenido, creado")
    .single();

  await svc
    .from("agente_conversaciones")
    .update({ ultimo_mensaje_en: new Date().toISOString() })
    .eq("id", conversacionId);

  revalidatePath("/admin/conversaciones");

  return {
    ok: true,
    estado: decision,
    pedido: pedidoInfo,
    nota: nota
      ? { id: nota.id as string, rol: "sistema", contenido: nota.contenido as string, creado: nota.creado as string }
      : undefined,
  };
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
