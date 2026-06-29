"use server";

import { revalidatePath } from "next/cache";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Guarda la config del agente de una tienda (alta sin programar).
// Corre con el cliente de SESIÓN: RLS permite superadmin (cualquier tienda) o
// admin/delegado (solo la suya).
export async function guardarConfigAgente(formData: FormData) {
  const perfil = await getPerfil();
  if (!perfil) throw new Error("No autorizado");

  const esSuper = perfil.rol === "superadmin";
  const tiendaId = esSuper
    ? String(formData.get("tienda_id") ?? "").trim()
    : perfil.tienda_id;
  if (!tiendaId) throw new Error("Falta la tienda");

  const txt = (k: string) => String(formData.get(k) ?? "").trim();
  const supabase = await createClient();

  const emojiMax = Math.min(Math.max(Number(formData.get("emoji_max")) || 2, 0), 5);

  const marca = {
    nombre: txt("nombre"),
    asesora: txt("asesora") || "PENDIENTE",
    voz: txt("voz"),
    emoji_max: emojiMax,
    presentacion: txt("presentacion") || undefined,
  };
  if (!marca.nombre) throw new Error("El nombre de la marca es obligatorio");

  const guardarrailes_extra = txt("guardarrailes")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const zonas: Record<string, string> = {};
  for (const z of ["norte", "centro", "sur"]) {
    const v = txt(`zona_${z}`);
    if (v) zonas[z] = v;
  }
  const origen = {
    ciudad: txt("ciudad") || undefined,
    zonas_envio: Object.keys(zonas).length ? zonas : undefined,
  };

  const tallas = txt("tallas") || null;
  const activa = formData.get("activa") === "on";

  const { error } = await supabase.from("agente_config").upsert(
    {
      tienda_id: tiendaId,
      activa,
      marca,
      guardarrailes_extra,
      origen,
      tallas,
      actualizado: new Date().toISOString(),
    },
    { onConflict: "tienda_id" },
  );
  if (error) throw new Error(`config: ${error.message}`);

  // Canal de WhatsApp (Phone Number ID) — opcional.
  const pnid = txt("wa_phone_number_id");
  if (pnid) {
    const { error: e2 } = await supabase.from("agente_canales").upsert(
      {
        tienda_id: tiendaId,
        tipo: "whatsapp",
        external_id: pnid,
        nombre: `WhatsApp ${marca.nombre}`,
        activo: true,
      },
      { onConflict: "tipo,external_id" },
    );
    if (e2) throw new Error(`canal: ${e2.message}`);
  }

  // Comisión del marketplace (solo el operador/superadmin la fija). Upsert que
  // preserva los tokens MP existentes (solo toca comision_pct).
  if (esSuper) {
    const comision = Math.min(Math.max(Number(formData.get("comision_pct")) || 0, 0), 100);
    await supabase
      .from("agente_secretos")
      .upsert({ tienda_id: tiendaId, comision_pct: comision }, { onConflict: "tienda_id" });
  }

  revalidatePath("/admin/agente/alta");
  revalidatePath("/admin/agente");
}

/** Desconecta la cuenta de Mercado Pago de la tienda. */
export async function desconectarMP(formData: FormData) {
  const perfil = await getPerfil();
  if (!perfil) throw new Error("No autorizado");
  const esSuper = perfil.rol === "superadmin";
  const tiendaId = esSuper ? String(formData.get("tienda_id") ?? "").trim() : perfil.tienda_id;
  if (!tiendaId) throw new Error("Falta la tienda");
  if (!esSuper && perfil.tienda_id !== tiendaId) throw new Error("No autorizado");

  const { desconectarTienda } = await import("@/lib/agente/mp-oauth");
  await desconectarTienda(tiendaId);
  revalidatePath("/admin/agente/alta");
}
