"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Cierra la sesión del admin y vuelve al login.
export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

// Guarda la inversión manual del inventario. Vacío -> null (vuelve al
// cálculo automático: Σ costo × piezas de lo existente).
export async function guardarInversion(formData: FormData) {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) throw new Error("No autorizado");
  const supabase = await createClient();
  const raw = String(formData.get("inversion") ?? "").trim();
  const valor = raw === "" ? null : Math.max(0, Number(raw));
  const { error } = await supabase
    .from("tiendas")
    .update({ inversion_manual: Number.isFinite(valor as number) ? valor : null })
    .eq("id", perfil.tienda_id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}
