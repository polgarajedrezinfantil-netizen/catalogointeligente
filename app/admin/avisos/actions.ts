"use server";

import { revalidatePath } from "next/cache";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

async function tiendaDelAdmin() {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) throw new Error("No autorizado");
  return perfil.tienda_id;
}

export async function marcarEnviado(formData: FormData) {
  const tienda_id = await tiendaDelAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notificaciones")
    .update({ estado: "enviado" })
    .eq("id", String(formData.get("id")))
    .eq("tienda_id", tienda_id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/avisos");
}

export async function marcarPendiente(formData: FormData) {
  const tienda_id = await tiendaDelAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notificaciones")
    .update({ estado: "pendiente" })
    .eq("id", String(formData.get("id")))
    .eq("tienda_id", tienda_id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/avisos");
}
