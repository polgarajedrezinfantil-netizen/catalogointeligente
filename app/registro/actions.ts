"use server";

import { redirect } from "next/navigation";
import { esSlugReservado } from "@/lib/saas/subdominios";
import { TRIAL_DIAS } from "@/lib/saas/suscripciones";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type EstadoRegistro = { ok: boolean; mensaje: string } | null;

// Mismo slug que usa el alta del superadmin (app/admin/tiendas/actions.ts).
function aSlug(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

// Registro self-service (Fase 3): crea tienda con prueba de 14 días + su
// admin, y lo deja dentro del panel en el mismo paso (la cuenta nace
// confirmada y con sesión iniciada; sin fricción de correo de confirmación).
export async function registrarTienda(
  _prev: EstadoRegistro,
  formData: FormData,
): Promise<EstadoRegistro> {
  // Honeypot anti-bots: el campo "web" está oculto; si viene lleno, es un bot.
  if (String(formData.get("web") ?? "").trim()) {
    return { ok: true, mensaje: "Listo." };
  }

  const tiendaNombre = String(formData.get("tienda") ?? "").trim();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!tiendaNombre || !nombre || !email) {
    return { ok: false, mensaje: "Completa todos los campos." };
  }
  if (password.length < 8) {
    return { ok: false, mensaje: "La contraseña necesita al menos 8 caracteres." };
  }

  const service = createServiceClient();

  // Correo ya registrado → a iniciar sesión.
  const { data: lista } = await service.auth.admin.listUsers({ perPage: 1000 });
  if ((lista?.users ?? []).some((u) => u.email?.toLowerCase() === email)) {
    return { ok: false, mensaje: "Ese correo ya tiene cuenta. Entra desde el panel." };
  }

  // Slug único (con sufijo si el nombre ya existe o está reservado — ver
  // INFRAESTRUCTURA.md, subdominios de infraestructura u otros productos).
  const slugBase = aSlug(tiendaNombre) || "tienda";
  let slug = slugBase;
  for (let i = 2; i < 50; i++) {
    if (!esSlugReservado(slug)) {
      const { data } = await service.from("tiendas").select("id").eq("slug", slug).maybeSingle();
      if (!data) break;
    }
    slug = `${slugBase}-${i}`;
  }

  // Tienda con prueba gratis corriendo desde hoy.
  const trial_hasta = new Date(Date.now() + TRIAL_DIAS * 86_400_000).toISOString();
  const { data: tienda, error: eT } = await service
    .from("tiendas")
    .insert({ nombre: tiendaNombre, slug, trial_hasta })
    .select("id")
    .single();
  if (eT || !tienda) {
    return { ok: false, mensaje: "No se pudo crear la tienda. Intenta de nuevo." };
  }
  await service.rpc("sembrar_lineas_demo", { p_tienda: tienda.id });

  // Admin de la tienda (el trigger de perfiles lo liga por la metadata).
  const { error: eU } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { rol: "admin", nombre, tienda_id: tienda.id },
  });
  if (eU) {
    await service.from("tiendas").delete().eq("id", tienda.id);
    return { ok: false, mensaje: `No se pudo crear la cuenta: ${eU.message}` };
  }

  // Sesión inmediata y directo al panel.
  const supabase = await createClient();
  const { error: eL } = await supabase.auth.signInWithPassword({ email, password });
  if (eL) {
    return { ok: true, mensaje: "Cuenta creada ✅ Entra al panel con tu correo y contraseña." };
  }
  redirect("/admin");
}
