"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Cierra la sesión del admin y vuelve al login.
export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
