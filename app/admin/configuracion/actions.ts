"use server";

import { revalidatePath } from "next/cache";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TipoCampo } from "@/lib/tipos";

// Devuelve la tienda del admin actual; lanza si no aplica.
async function tiendaDelAdmin() {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) throw new Error("No autorizado");
  return perfil.tienda_id;
}

// Convierte "rojo, azul, verde" -> ["rojo","azul","verde"].
function aOpciones(texto: string): string[] {
  return texto
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Normaliza un enlace: agrega https:// si falta y vacío -> null.
function normalizarUrl(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return "https://" + s.replace(/^\/+/, "");
}

function textoONull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}

// ---------------- Configuración general ----------------
export async function guardarConfigGeneral(formData: FormData) {
  const tienda_id = await tiendaDelAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("tiendas")
    .update({
      nombre: String(formData.get("nombre") ?? "").trim(),
      whatsapp: String(formData.get("whatsapp") ?? "").trim() || null,
      hold_horas: Number(formData.get("hold_horas") ?? 6),
      moneda: String(formData.get("moneda") ?? "MXN"),
      etiqueta_precio: String(formData.get("etiqueta_precio") ?? "$"),
      // El % se captura como 50 (=> 0.5) para que sea intuitivo.
      ganancia_default: Number(formData.get("ganancia_pct") ?? 50) / 100,
      precio_general_default:
        formData.get("precio_general") === ""
          ? null
          : Number(formData.get("precio_general")),
      lista_espera_global: formData.get("lista_espera_global") === "on",
      whatsapp_api_activa: formData.get("whatsapp_api_activa") === "on",
      datos_pago: String(formData.get("datos_pago") ?? "").trim() || null,
      actualizado: new Date().toISOString(),
    })
    .eq("id", tienda_id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/configuracion");
}

// ---------------- Logo de la tienda ----------------
export async function guardarLogo(formData: FormData) {
  const tienda_id = await tiendaDelAdmin();
  const supabase = await createClient();
  const logo = String(formData.get("logo") ?? "").trim() || null;
  const { error } = await supabase
    .from("tiendas")
    .update({ logo_url: logo, actualizado: new Date().toISOString() })
    .eq("id", tienda_id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/configuracion");
}

// ---------------- Contacto y redes ----------------
export async function guardarContacto(formData: FormData) {
  const tienda_id = await tiendaDelAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("tiendas")
    .update({
      instagram_url: normalizarUrl(formData.get("instagram_url")),
      facebook_url: normalizarUrl(formData.get("facebook_url")),
      tiktok_url: normalizarUrl(formData.get("tiktok_url")),
      maps_url: normalizarUrl(formData.get("maps_url")),
      direccion: textoONull(formData.get("direccion")),
      horario: textoONull(formData.get("horario")),
      bio: textoONull(formData.get("bio")),
      actualizado: new Date().toISOString(),
    })
    .eq("id", tienda_id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/configuracion");
}

// ---------------- Líneas de venta ----------------
export async function crearLinea(formData: FormData) {
  const tienda_id = await tiendaDelAdmin();
  const supabase = await createClient();
  const { count } = await supabase
    .from("lineas_de_venta")
    .select("id", { count: "exact", head: true })
    .eq("tienda_id", tienda_id);
  const { error } = await supabase.from("lineas_de_venta").insert({
    tienda_id,
    nombre: String(formData.get("nombre") ?? "Nueva línea").trim(),
    icono: String(formData.get("icono") ?? "🧺") || "🧺",
    color: String(formData.get("color") ?? "#A6C972"),
    orden: (count ?? 0) + 1,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/configuracion");
}

export async function actualizarLinea(formData: FormData) {
  const tienda_id = await tiendaDelAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("lineas_de_venta")
    .update({
      nombre: String(formData.get("nombre") ?? "").trim(),
      icono: String(formData.get("icono") ?? "🧺"),
      color: String(formData.get("color") ?? "#A6C972"),
    })
    .eq("id", String(formData.get("linea_id")))
    .eq("tienda_id", tienda_id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/configuracion");
}

export async function archivarLinea(formData: FormData) {
  const tienda_id = await tiendaDelAdmin();
  const supabase = await createClient();
  const archivar = formData.get("archivada") !== "true"; // alterna
  const { error } = await supabase
    .from("lineas_de_venta")
    .update({ archivada: archivar })
    .eq("id", String(formData.get("linea_id")))
    .eq("tienda_id", tienda_id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/configuracion");
}

// Mueve una línea hacia arriba/abajo intercambiando el `orden`.
export async function moverLinea(formData: FormData) {
  const tienda_id = await tiendaDelAdmin();
  const id = String(formData.get("linea_id"));
  const dir = String(formData.get("dir")); // 'arriba' | 'abajo'
  const supabase = await createClient();
  const { data: lineas } = await supabase
    .from("lineas_de_venta")
    .select("id, orden")
    .eq("tienda_id", tienda_id)
    .order("orden");
  if (!lineas) return;
  const i = lineas.findIndex((l) => l.id === id);
  const j = dir === "arriba" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= lineas.length) return;
  // Intercambia órdenes.
  await supabase
    .from("lineas_de_venta")
    .update({ orden: lineas[j].orden })
    .eq("id", lineas[i].id);
  await supabase
    .from("lineas_de_venta")
    .update({ orden: lineas[i].orden })
    .eq("id", lineas[j].id);
  revalidatePath("/admin/configuracion");
}

// ---------------- Campos por línea ----------------
export async function crearCampo(formData: FormData) {
  const tienda_id = await tiendaDelAdmin();
  const linea_id = String(formData.get("linea_id"));
  const supabase = await createClient();
  const { count } = await supabase
    .from("campos_linea")
    .select("id", { count: "exact", head: true })
    .eq("linea_id", linea_id);
  const { error } = await supabase.from("campos_linea").insert({
    linea_id,
    tienda_id,
    nombre: String(formData.get("nombre") ?? "Campo").trim(),
    tipo: String(formData.get("tipo") ?? "texto") as TipoCampo,
    opciones: aOpciones(String(formData.get("opciones") ?? "")),
    obligatorio: formData.get("obligatorio") === "on",
    es_filtro: formData.get("es_filtro") === "on",
    orden: (count ?? 0) + 1,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/configuracion");
}

export async function actualizarCampo(formData: FormData) {
  const tienda_id = await tiendaDelAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("campos_linea")
    .update({
      nombre: String(formData.get("nombre") ?? "").trim(),
      tipo: String(formData.get("tipo") ?? "texto") as TipoCampo,
      opciones: aOpciones(String(formData.get("opciones") ?? "")),
      obligatorio: formData.get("obligatorio") === "on",
      es_filtro: formData.get("es_filtro") === "on",
    })
    .eq("id", String(formData.get("campo_id")))
    .eq("tienda_id", tienda_id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/configuracion");
}

export async function archivarCampo(formData: FormData) {
  const tienda_id = await tiendaDelAdmin();
  const supabase = await createClient();
  const archivar = formData.get("archivado") !== "true";
  const { error } = await supabase
    .from("campos_linea")
    .update({ archivado: archivar })
    .eq("id", String(formData.get("campo_id")))
    .eq("tienda_id", tienda_id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/configuracion");
}

// ---------------- Cupones de descuento ----------------
export async function crearCupon(formData: FormData) {
  const tienda_id = await tiendaDelAdmin();
  const supabase = await createClient();
  const palabra = String(formData.get("palabra") ?? "").trim();
  const porcentaje = Number(formData.get("porcentaje") ?? 0);
  if (!palabra || !(porcentaje > 0 && porcentaje <= 100)) {
    throw new Error("Pon una palabra y un porcentaje entre 1 y 100.");
  }
  const { error } = await supabase
    .from("cupones")
    .insert({ tienda_id, palabra, porcentaje });
  if (error) {
    // Choque con la palabra única.
    if (error.code === "23505") throw new Error("Ya existe un cupón con esa palabra.");
    throw new Error(error.message);
  }
  revalidatePath("/admin/configuracion");
}

export async function alternarCupon(formData: FormData) {
  const tienda_id = await tiendaDelAdmin();
  const supabase = await createClient();
  const activar = formData.get("activo") !== "true"; // alterna
  const { error } = await supabase
    .from("cupones")
    .update({ activo: activar })
    .eq("id", String(formData.get("cupon_id")))
    .eq("tienda_id", tienda_id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/configuracion");
}

export async function borrarCupon(formData: FormData) {
  const tienda_id = await tiendaDelAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("cupones")
    .delete()
    .eq("id", String(formData.get("cupon_id")))
    .eq("tienda_id", tienda_id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/configuracion");
}
