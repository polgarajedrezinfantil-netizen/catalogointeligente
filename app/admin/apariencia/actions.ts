"use server";

import { revalidatePath } from "next/cache";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TEMA_DEFAULT, type Tema } from "@/lib/tema";

async function tiendaDelAdmin() {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) throw new Error("No autorizado");
  return perfil.tienda_id;
}

function textoONull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}

export type EstadoApariencia = { ok: boolean; mensaje: string } | null;

// Guarda paleta, textos, banner y preview social de la tienda.
export async function guardarApariencia(
  _prev: EstadoApariencia,
  formData: FormData,
): Promise<EstadoApariencia> {
  const tienda_id = await tiendaDelAdmin();
  const supabase = await createClient();

  // El tema llega como JSON; validamos cada color (#RRGGBB) y rellenamos
  // con la marca lo que venga roto, para no romper el catálogo.
  let tema: Tema = { ...TEMA_DEFAULT };
  try {
    const parsed = JSON.parse(String(formData.get("tema") ?? "{}"));
    if (parsed && typeof parsed === "object") tema = { ...TEMA_DEFAULT, ...parsed };
  } catch {
    /* deja la marca */
  }
  for (const k of Object.keys(tema)) {
    if (!/^#[0-9a-fA-F]{6}$/.test(tema[k])) tema[k] = TEMA_DEFAULT[k] ?? "#000000";
  }

  const { error } = await supabase
    .from("tiendas")
    .update({
      tema,
      subtitulo: textoONull(formData.get("subtitulo")),
      descripcion: textoONull(formData.get("descripcion")),
      og_titulo: textoONull(formData.get("og_titulo")),
      og_descripcion: textoONull(formData.get("og_descripcion")),
      banner_url: String(formData.get("banner") ?? "").trim() || null,
      actualizado: new Date().toISOString(),
    })
    .eq("id", tienda_id);

  if (error) return { ok: false, mensaje: error.message };
  revalidatePath("/admin/apariencia");
  return { ok: true, mensaje: "Apariencia guardada. Ya se ve en tu catálogo 🍯" };
}
