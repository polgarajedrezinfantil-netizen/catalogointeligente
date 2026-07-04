"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { baseUrl } from "@/lib/agente/urls";

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

export type EstadoReset = { ok: boolean; mensaje: string } | null;

// "¿Olvidaste tu contraseña?": envía un enlace de recuperación al correo.
// El enlace llega a /auth/recuperar, que abre la sesión y manda a poner una
// nueva contraseña. El envío usa el correo de Supabase (revisar spam).
export async function solicitarRecuperacion(
  _prev: EstadoReset,
  formData: FormData,
): Promise<EstadoReset> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { ok: false, mensaje: "Escribe tu correo." };

  const h = await headers();
  const host = h.get("host");
  const origin = h.get("origin") ?? (host ? `https://${host}` : baseUrl());

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/recuperar`,
  });
  if (error) return { ok: false, mensaje: error.message };

  return {
    ok: true,
    mensaje:
      "Listo. Si el correo está registrado, te enviamos un enlace para crear una nueva contraseña. Revisa tu bandeja y la carpeta de spam.",
  };
}
