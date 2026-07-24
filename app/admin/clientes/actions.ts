"use server";

import { revalidatePath } from "next/cache";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

async function tiendaDelAdmin() {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) throw new Error("No autorizado");
  return perfil;
}

// La ficha vive en una ruta dinámica: hay que refrescarla por patrón.
function refrescarClientes() {
  revalidatePath("/admin/clientes");
  revalidatePath("/admin/clientes/[celular]", "page");
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
  refrescarClientes();
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
  refrescarClientes();
}

// Nota privada de la tienda sobre el cliente (no la ve nadie más).
export async function guardarNota(formData: FormData) {
  const perfil = await tiendaDelAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("guardar_cliente_crm", {
    p_tienda: perfil.tienda_id,
    p_celular: String(formData.get("celular")),
    p_nota: String(formData.get("nota") ?? ""),
  });
  if (error) throw new Error(error.message);
  refrescarClientes();
}

// Etiquetas libres: llegan como texto separado por comas.
export async function guardarEtiquetas(formData: FormData) {
  const perfil = await tiendaDelAdmin();
  const etiquetas = String(formData.get("etiquetas") ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean)
    .slice(0, 12);

  const supabase = await createClient();
  const { error } = await supabase.rpc("guardar_cliente_crm", {
    p_tienda: perfil.tienda_id,
    p_celular: String(formData.get("celular")),
    p_etiquetas: [...new Set(etiquetas)],
  });
  if (error) throw new Error(error.message);
  refrescarClientes();
}

// "No molestar": la tienda marca que este cliente no quiere seguimiento.
export async function alternarNoMolestar(formData: FormData) {
  const perfil = await tiendaDelAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("guardar_cliente_crm", {
    p_tienda: perfil.tienda_id,
    p_celular: String(formData.get("celular")),
    p_no_molestar: formData.get("valor") === "1",
  });
  if (error) throw new Error(error.message);
  refrescarClientes();
}
