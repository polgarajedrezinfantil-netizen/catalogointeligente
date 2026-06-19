"use server";

import { redirect } from "next/navigation";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Crea un producto a partir del resultado del módulo de IA y lleva al
// formulario de productos para afinarlo.
export async function crearProductoIA(formData: FormData) {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) throw new Error("No autorizado");
  const supabase = await createClient();

  let precios: unknown = [];
  try {
    precios = JSON.parse(String(formData.get("precios_encontrados") ?? "[]"));
  } catch {}

  const { error } = await supabase.from("productos").insert({
    tienda_id: perfil.tienda_id,
    nombre: String(formData.get("nombre") ?? "").trim() || "Producto",
    descripcion: String(formData.get("descripcion") ?? "") || null,
    costo: Number(formData.get("costo") ?? 0),
    precio: Number(formData.get("precio") ?? 0),
    cantidad: Number(formData.get("cantidad") ?? 1),
    fotos: JSON.parse(String(formData.get("fotos") ?? "[]")),
    precios_encontrados: precios,
  });
  if (error) throw new Error(error.message);
  redirect("/admin/productos");
}
