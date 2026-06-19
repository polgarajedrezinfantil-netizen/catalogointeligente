import { createClient } from "@/lib/supabase/server";
import type { Perfil } from "@/lib/tipos";

/**
 * Devuelve el perfil del usuario autenticado (o null si no hay sesión / no
 * está autorizado). Úsalo en Server Components y Server Actions del panel.
 */
export async function getPerfil(): Promise<Perfil | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("perfiles")
    .select("id, nombre, rol, tienda_id")
    .eq("id", user.id)
    .maybeSingle();

  return (data as Perfil) ?? null;
}
