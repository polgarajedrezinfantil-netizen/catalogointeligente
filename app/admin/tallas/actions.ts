"use server";

import { revalidatePath } from "next/cache";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

async function tiendaDelAdmin() {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) throw new Error("No autorizado");
  return perfil.tienda_id;
}

export type EstadoGuia = { ok: boolean; mensaje: string } | null;

// Crea o actualiza una guía de tallas. Recibe la tabla serializada en "payload".
export async function guardarGuia(
  _prev: EstadoGuia,
  formData: FormData,
): Promise<EstadoGuia> {
  const tienda_id = await tiendaDelAdmin();
  const supabase = await createClient();

  let payload: {
    id?: string;
    nombre?: string;
    linea_id?: string | null;
    columnas?: string[];
    filas?: string[][];
    activa?: boolean;
  };
  try {
    payload = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { ok: false, mensaje: "Datos inválidos." };
  }

  const nombre = String(payload.nombre ?? "").trim();
  if (!nombre) return { ok: false, mensaje: "Ponle un nombre a la guía (ej. “Ropa”)." };

  const columnas = (payload.columnas ?? []).map((c) => String(c).trim()).filter(Boolean);
  if (columnas.length === 0) return { ok: false, mensaje: "Agrega al menos una columna." };

  // Recorta cada fila al número de columnas y descarta filas totalmente vacías.
  const filas = (payload.filas ?? [])
    .map((f) => columnas.map((_, i) => String(f?.[i] ?? "").trim()))
    .filter((f) => f.some((c) => c !== ""));

  const datos = {
    tienda_id,
    nombre,
    linea_id: payload.linea_id || null,
    columnas,
    filas,
    activa: payload.activa !== false,
  };

  if (payload.id) {
    const { error } = await supabase
      .from("guias_tallas")
      .update(datos)
      .eq("id", payload.id)
      .eq("tienda_id", tienda_id);
    if (error) return { ok: false, mensaje: error.message };
  } else {
    const { error } = await supabase.from("guias_tallas").insert(datos);
    if (error) return { ok: false, mensaje: error.message };
  }
  revalidatePath("/admin/tallas");
  return { ok: true, mensaje: "Guía guardada ✅" };
}

export async function borrarGuia(formData: FormData) {
  const tienda_id = await tiendaDelAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("guias_tallas")
    .delete()
    .eq("id", String(formData.get("guia_id")))
    .eq("tienda_id", tienda_id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/tallas");
}
