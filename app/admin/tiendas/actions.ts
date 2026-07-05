"use server";

import { revalidatePath } from "next/cache";
import { getPerfil } from "@/lib/auth";
import { crearSuscripcion, saasCobroConfigurado } from "@/lib/saas/suscripciones";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// Convierte un nombre en slug para el link público (/<slug>/...).
function aSlug(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

// Solo el superadmin puede operar aquí.
async function exigirSuperadmin() {
  const perfil = await getPerfil();
  if (perfil?.rol !== "superadmin") {
    throw new Error("No autorizado");
  }
}

export async function crearTienda(formData: FormData) {
  await exigirSuperadmin();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const plan = String(formData.get("plan") ?? "basico");
  const sembrar = formData.get("sembrar") === "on";
  if (!nombre) throw new Error("El nombre es obligatorio");

  const slugBase = aSlug(nombre) || "tienda";
  const supabase = await createClient();

  // Garantiza un slug único agregando sufijo si ya existe.
  let slug = slugBase;
  for (let i = 2; i < 50; i++) {
    const { data } = await supabase
      .from("tiendas")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) break;
    slug = `${slugBase}-${i}`;
  }

  const { data: tienda, error } = await supabase
    .from("tiendas")
    .insert({ nombre, slug, plan_clave: plan })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // Siembra líneas + campos de ejemplo (opcional).
  if (sembrar && tienda) {
    await supabase.rpc("sembrar_lineas_demo", { p_tienda: tienda.id });
  }

  revalidatePath("/admin/tiendas");
}

export async function cambiarPlan(formData: FormData) {
  await exigirSuperadmin();
  const id = String(formData.get("tienda_id"));
  const plan = String(formData.get("plan"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("tiendas")
    .update({ plan_clave: plan })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/tiendas");
}

export async function alternarActiva(formData: FormData) {
  await exigirSuperadmin();
  const id = String(formData.get("tienda_id"));
  const activa = formData.get("activa") === "true";
  const supabase = await createClient();
  const { error } = await supabase
    .from("tiendas")
    .update({ activa: !activa })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/tiendas");
}

// Genera una contraseña temporal legible para compartir.
function generarPassword() {
  const base = Math.random().toString(36).slice(2, 8);
  return `Nido-${base}${Math.floor(Math.random() * 90 + 10)}`;
}

export type EstadoInvitacion = { ok: boolean; mensaje: string } | null;

// Da de alta a un admin/delegado de tienda. Dos modos:
//  - "password": crea la cuenta con una contraseña temporal (se muestra para
//                compartir). No depende de correo.
//  - "correo":   envía una invitación por email (requiere SMTP configurado).
// La metadata dispara el trigger que crea el perfil ligado a la tienda.
export async function gestionarInvitacion(
  _prev: EstadoInvitacion,
  formData: FormData,
): Promise<EstadoInvitacion> {
  await exigirSuperadmin();
  const tienda_id = String(formData.get("tienda_id"));
  const email = String(formData.get("email") ?? "").trim();
  const nombre =
    String(formData.get("nombre") ?? "").trim() || email.split("@")[0];
  const rol = String(formData.get("rol") ?? "admin");
  const modo = String(formData.get("modo") ?? "password");
  if (!email) return { ok: false, mensaje: "El correo es obligatorio." };

  const admin = createServiceClient();

  if (modo === "correo") {
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { rol, nombre, tienda_id },
    });
    if (error) return { ok: false, mensaje: error.message };
    revalidatePath("/admin/tiendas");
    return { ok: true, mensaje: `Invitación enviada a ${email}.` };
  }

  const password = generarPassword();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { rol, nombre, tienda_id },
  });
  if (error) return { ok: false, mensaje: error.message };
  revalidatePath("/admin/tiendas");
  return {
    ok: true,
    mensaje: `Cuenta creada para ${email}. Contraseña temporal: ${password}`,
  };
}

// El superadmin restablece la contraseña de un usuario de tienda y obtiene
// una contraseña temporal para compartir.
export async function restablecerPassword(
  _prev: EstadoInvitacion,
  formData: FormData,
): Promise<EstadoInvitacion> {
  await exigirSuperadmin();
  const user_id = String(formData.get("user_id"));
  if (!user_id) return { ok: false, mensaje: "Falta el usuario." };

  const password = generarPassword();
  const admin = createServiceClient();
  const { error } = await admin.auth.admin.updateUserById(user_id, { password });
  if (error) return { ok: false, mensaje: error.message };

  return { ok: true, mensaje: `Nueva contraseña: ${password}` };
}

// Crea (o regenera) la suscripción mensual de MP para una tienda y guarda
// el link de pago que se le comparte al dueño.
export async function gestionarSuscripcion(
  _prev: EstadoInvitacion,
  formData: FormData,
): Promise<EstadoInvitacion> {
  await exigirSuperadmin();
  const tienda_id = String(formData.get("tienda_id"));
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { ok: false, mensaje: "Falta el correo del dueño (su cuenta de Mercado Pago)." };
  if (!saasCobroConfigurado()) {
    return {
      ok: false,
      mensaje: "Falta MP_SAAS_ACCESS_TOKEN en el entorno (app de Suscripciones de MP del operador).",
    };
  }

  const admin = createServiceClient();
  const { data: tienda, error } = await admin
    .from("tiendas")
    .select("id, nombre, precio_mensual")
    .eq("id", tienda_id)
    .single();
  if (error || !tienda) return { ok: false, mensaje: "Tienda no encontrada." };

  try {
    const s = await crearSuscripcion(
      { id: tienda.id, nombre: tienda.nombre, precio_mensual: Number(tienda.precio_mensual) },
      email,
    );
    const { error: eUpd } = await admin
      .from("tiendas")
      .update({ mp_suscripcion_id: s.id, mp_init_point: s.init_point })
      .eq("id", tienda_id);
    if (eUpd) return { ok: false, mensaje: eUpd.message };
    revalidatePath("/admin/tiendas");
    return { ok: true, mensaje: `Link de cobro listo: ${s.init_point}` };
  } catch (e) {
    return { ok: false, mensaje: e instanceof Error ? e.message : "Error con Mercado Pago." };
  }
}

// Registra un mes pagado a mano (transferencia/efectivo): corre la fecha
// pagada un mes desde hoy (o desde el vencimiento si aún no llega) y
// reenciende la tienda si estaba apagada por impago.
export async function extenderMes(formData: FormData) {
  await exigirSuperadmin();
  const tienda_id = String(formData.get("tienda_id"));
  const admin = createServiceClient();
  const { data: tienda, error } = await admin
    .from("tiendas")
    .select("suscripcion_hasta, apagada_por_impago")
    .eq("id", tienda_id)
    .single();
  if (error || !tienda) throw new Error("Tienda no encontrada");

  const base = Math.max(
    Date.now(),
    tienda.suscripcion_hasta ? new Date(tienda.suscripcion_hasta).getTime() : 0,
  );
  const nueva = new Date(base);
  nueva.setMonth(nueva.getMonth() + 1);

  const { error: eUpd } = await admin
    .from("tiendas")
    .update({
      suscripcion_hasta: nueva.toISOString(),
      ...(tienda.apagada_por_impago ? { activa: true, apagada_por_impago: false } : {}),
    })
    .eq("id", tienda_id);
  if (eUpd) throw new Error(eUpd.message);
  revalidatePath("/admin/tiendas");
}

// El superadmin elimina por completo la cuenta de un usuario de tienda.
export async function eliminarUsuario(formData: FormData) {
  await exigirSuperadmin();
  const user_id = String(formData.get("user_id"));
  if (!user_id) throw new Error("Falta el usuario");

  const perfil = await getPerfil();
  if (perfil?.id === user_id) {
    throw new Error("No puedes eliminar tu propia cuenta.");
  }

  const admin = createServiceClient();
  const { error } = await admin.auth.admin.deleteUser(user_id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/tiendas");
}
