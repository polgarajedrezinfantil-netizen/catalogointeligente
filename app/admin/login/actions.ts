"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type EstadoLogin = { error: string } | null;

// Inicia sesión EN EL SERVIDOR: el cliente de Supabase escribe la cookie de
// sesión en la misma respuesta, así el panel ya ve al usuario al redirigir
// (evita la carrera que rebotaba al login).
export async function iniciarSesion(
  _prev: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      error: error.message.includes("Invalid")
        ? "Correo o contraseña incorrectos."
        : error.message,
    };
  }
  redirect("/admin");
}
