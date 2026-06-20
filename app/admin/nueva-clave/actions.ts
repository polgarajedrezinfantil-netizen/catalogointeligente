"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type EstadoClave = { error: string } | null;

// Guarda la contraseña nueva del usuario en sesión (flujo de recuperación).
export async function actualizarClave(
  _prev: EstadoClave,
  formData: FormData,
): Promise<EstadoClave> {
  const password = String(formData.get("password") ?? "");
  const password2 = String(formData.get("password2") ?? "");
  if (password.length < 8) return { error: "Usa al menos 8 caracteres." };
  if (password !== password2) return { error: "Las contraseñas no coinciden." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "El enlace venció. Pide uno nuevo desde el login." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect("/admin");
}
