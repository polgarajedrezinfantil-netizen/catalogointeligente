"use server";

import { revalidatePath } from "next/cache";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

async function tiendaDelAdmin() {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) throw new Error("No autorizado");
  return perfil;
}

// Registra en la bitácora que se envió un mensaje (ej. por WhatsApp).
export async function registrarMensaje(formData: FormData) {
  const perfil = await tiendaDelAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("mensajes").insert({
    tienda_id: perfil.tienda_id,
    celular: String(formData.get("celular") ?? "") || null,
    canal: String(formData.get("canal") ?? "whatsapp"),
    cuerpo: String(formData.get("cuerpo") ?? "").trim(),
    enviado_por: perfil.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/clientes");
}

// Marca una solicitud como atendida.
export async function atenderSolicitud(formData: FormData) {
  const perfil = await tiendaDelAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("solicitudes_cliente")
    .update({ estado: "atendida" })
    .eq("id", String(formData.get("solicitud_id")))
    .eq("tienda_id", perfil.tienda_id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/clientes");
}
