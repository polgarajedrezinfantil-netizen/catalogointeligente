"use server";

import { revalidatePath } from "next/cache";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

async function tiendaDelAdmin() {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) throw new Error("No autorizado");
  return perfil.tienda_id;
}

export type EstadoNido = { ok: boolean; mensaje: string } | null;

export async function crearNido(
  _prev: EstadoNido,
  formData: FormData,
): Promise<EstadoNido> {
  const tienda_id = await tiendaDelAdmin();
  const supabase = await createClient();
  const { count } = await supabase
    .from("nidos")
    .select("id", { count: "exact", head: true })
    .eq("tienda_id", tienda_id);
  const { error } = await supabase.from("nidos").insert({
    tienda_id,
    nombre: String(formData.get("nombre") ?? "Nuevo Nido").trim(),
    fecha: String(formData.get("fecha") || new Date().toISOString().slice(0, 10)),
    foto_portada_url: String(formData.get("foto_portada_url") ?? "") || null,
    orden: (count ?? 0) + 1,
  });
  // El trigger del límite del plan puede rechazar la activación.
  if (error) return { ok: false, mensaje: error.message };
  revalidatePath("/admin/nidos");
  return { ok: true, mensaje: "Nido creado." };
}

export async function actualizarNido(formData: FormData) {
  const tienda_id = await tiendaDelAdmin();
  const supabase = await createClient();
  const patch: Record<string, unknown> = {
    nombre: String(formData.get("nombre") ?? "").trim(),
    fecha: String(formData.get("fecha")),
    es_nuevo: formData.get("es_nuevo") === "on",
  };
  const foto = String(formData.get("foto_portada_url") ?? "");
  if (foto) patch.foto_portada_url = foto;
  const { error } = await supabase
    .from("nidos")
    .update(patch)
    .eq("id", String(formData.get("nido_id")))
    .eq("tienda_id", tienda_id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/nidos");
}

export type EstadoActivar = { ok: boolean; mensaje: string } | null;

export async function alternarActivoNido(
  _prev: EstadoActivar,
  formData: FormData,
): Promise<EstadoActivar> {
  const tienda_id = await tiendaDelAdmin();
  const supabase = await createClient();
  const activar = formData.get("activo") !== "true"; // alterna
  const { error } = await supabase
    .from("nidos")
    .update({ activo: activar })
    .eq("id", String(formData.get("nido_id")))
    .eq("tienda_id", tienda_id);
  if (error) {
    // Mensaje amable cuando se alcanza el límite del plan.
    const lim = error.message.includes("Límite del plan");
    return {
      ok: false,
      mensaje: lim
        ? "Alcanzaste el límite de catálogos activos de tu plan. Desactiva otro o sube de plan."
        : error.message,
    };
  }
  revalidatePath("/admin/nidos");
  return { ok: true, mensaje: activar ? "Nido activado." : "Nido desactivado." };
}

export async function borrarNido(formData: FormData) {
  const tienda_id = await tiendaDelAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("nidos")
    .delete()
    .eq("id", String(formData.get("nido_id")))
    .eq("tienda_id", tienda_id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/nidos");
}
