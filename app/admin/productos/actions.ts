"use server";

import { revalidatePath } from "next/cache";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

async function tiendaDelAdmin() {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) throw new Error("No autorizado");
  return perfil.tienda_id;
}

// Reconstruye el objeto de atributos a partir de los inputs `attr_<campoId>`.
function leerAtributos(formData: FormData): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    if (!key.startsWith("attr_")) continue;
    const campoId = key.slice(5);
    const valores = formData.getAll(key).map(String).filter((v) => v !== "");
    if (valores.length === 0) continue;
    attrs[campoId] = valores.length > 1 ? valores : valores[0];
  }
  return attrs;
}

function leerFotos(formData: FormData): string[] {
  try {
    const raw = String(formData.get("fotos") ?? "[]");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export type EstadoProd = { ok: boolean; mensaje: string } | null;

export async function crearProducto(
  _prev: EstadoProd,
  formData: FormData,
): Promise<EstadoProd> {
  const tienda_id = await tiendaDelAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("productos").insert({
    tienda_id,
    nombre: String(formData.get("nombre") ?? "").trim(),
    descripcion: String(formData.get("descripcion") ?? "") || null,
    linea_id: String(formData.get("linea_id") || "") || null,
    nido_id: String(formData.get("nido_id") || "") || null,
    costo: Number(formData.get("costo") ?? 0),
    precio: Number(formData.get("precio") ?? 0),
    cantidad: Number(formData.get("cantidad") ?? 1),
    categoria: String(formData.get("categoria") ?? "") || null,
    genero: String(formData.get("genero") || "") || null,
    fotos: leerFotos(formData),
    atributos: leerAtributos(formData),
  });
  if (error) return { ok: false, mensaje: error.message };
  revalidatePath("/admin/productos");
  return { ok: true, mensaje: "Producto creado." };
}

export async function actualizarProducto(
  _prev: EstadoProd,
  formData: FormData,
): Promise<EstadoProd> {
  const tienda_id = await tiendaDelAdmin();
  const supabase = await createClient();
  const patch: Record<string, unknown> = {
    nombre: String(formData.get("nombre") ?? "").trim(),
    descripcion: String(formData.get("descripcion") ?? "") || null,
    linea_id: String(formData.get("linea_id") || "") || null,
    nido_id: String(formData.get("nido_id") || "") || null,
    costo: Number(formData.get("costo") ?? 0),
    precio: Number(formData.get("precio") ?? 0),
    cantidad: Number(formData.get("cantidad") ?? 1),
    categoria: String(formData.get("categoria") ?? "") || null,
    genero: String(formData.get("genero") || "") || null,
    atributos: leerAtributos(formData),
    actualizado: new Date().toISOString(),
  };
  const fotos = leerFotos(formData);
  if (fotos.length > 0) patch.fotos = fotos;
  const { error } = await supabase
    .from("productos")
    .update(patch)
    .eq("id", String(formData.get("producto_id")))
    .eq("tienda_id", tienda_id);
  if (error) return { ok: false, mensaje: error.message };
  revalidatePath("/admin/productos");
  return { ok: true, mensaje: "Producto actualizado." };
}

export async function borrarProducto(formData: FormData) {
  const tienda_id = await tiendaDelAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("productos")
    .delete()
    .eq("id", String(formData.get("producto_id")))
    .eq("tienda_id", tienda_id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/productos");
}

// --- Controles de apartado (Fase 4) vía RPCs autorizadas ---
async function rpcApartado(rpc: string, args: Record<string, unknown>) {
  await tiendaDelAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc(rpc, args);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/productos");
}

export async function confirmarApartado(formData: FormData) {
  await rpcApartado("confirmar_admin", {
    p_producto: String(formData.get("producto_id")),
  });
}

export async function venderProducto(formData: FormData) {
  const precio = formData.get("precio_final");
  await rpcApartado("vender_admin", {
    p_producto: String(formData.get("producto_id")),
    p_precio_final: precio === "" || precio == null ? null : Number(precio),
  });
}

export async function liberarApartado(formData: FormData) {
  await rpcApartado("liberar_admin", {
    p_producto: String(formData.get("producto_id")),
  });
}

export async function agotarProducto(formData: FormData) {
  await rpcApartado("agotar_admin", {
    p_producto: String(formData.get("producto_id")),
  });
}
