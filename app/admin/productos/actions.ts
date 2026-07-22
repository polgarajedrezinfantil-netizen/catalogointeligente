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

// Lee el precio de oferta (vacío -> null).
function leerOferta(formData: FormData): number | null {
  const v = formData.get("precio_oferta");
  return v === "" || v == null ? null : Number(v);
}

// Validaciones para no guardar datos rotos.
function validar(d: {
  nombre: string;
  precio: number;
  costo: number;
  oferta: number | null;
}): string | null {
  if (!d.nombre) return "El nombre es obligatorio.";
  if (d.precio < 0 || d.costo < 0) return "Los precios no pueden ser negativos.";
  if (d.oferta != null && (d.oferta <= 0 || d.oferta >= d.precio)) {
    return "El precio de oferta debe ser mayor a 0 y menor al precio normal.";
  }
  return null;
}

export async function crearProducto(
  _prev: EstadoProd,
  formData: FormData,
): Promise<EstadoProd> {
  const tienda_id = await tiendaDelAdmin();
  const supabase = await createClient();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const precio = Number(formData.get("precio") ?? 0);
  const costo = Number(formData.get("costo") ?? 0);
  const oferta = leerOferta(formData);
  const err = validar({ nombre, precio, costo, oferta });
  if (err) return { ok: false, mensaje: err };

  const { error } = await supabase.from("productos").insert({
    tienda_id,
    nombre,
    descripcion: String(formData.get("descripcion") ?? "") || null,
    linea_id: String(formData.get("linea_id") || "") || null,
    nido_id: String(formData.get("nido_id") || "") || null,
    costo,
    precio,
    precio_oferta: oferta,
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
  const nombre = String(formData.get("nombre") ?? "").trim();
  const precio = Number(formData.get("precio") ?? 0);
  const costo = Number(formData.get("costo") ?? 0);
  const oferta = leerOferta(formData);
  const err = validar({ nombre, precio, costo, oferta });
  if (err) return { ok: false, mensaje: err };

  const patch: Record<string, unknown> = {
    nombre,
    descripcion: String(formData.get("descripcion") ?? "") || null,
    linea_id: String(formData.get("linea_id") || "") || null,
    nido_id: String(formData.get("nido_id") || "") || null,
    costo,
    precio,
    precio_oferta: oferta,
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

export type EstadoRapido = { ok: boolean; mensaje: string } | null;

// Edición rápida desde la Vista Cliente: nombre, precio, oferta, talla y ocultar.
export async function editarRapido(formData: FormData): Promise<EstadoRapido> {
  const tienda_id = await tiendaDelAdmin();
  const supabase = await createClient();
  const id = String(formData.get("producto_id"));
  const nombre = String(formData.get("nombre") ?? "").trim();
  const precio = Number(formData.get("precio") ?? 0);
  const oferta = leerOferta(formData);
  const oculto = formData.get("oculto") === "on";
  const err = validar({ nombre, precio, costo: 0, oferta });
  if (err) return { ok: false, mensaje: err };

  const patch: Record<string, unknown> = {
    nombre,
    precio,
    precio_oferta: oferta,
    oculto,
    actualizado: new Date().toISOString(),
  };

  // Talla (si la Vista mandó el campo): se guarda dentro de atributos.
  const tallaCampo = String(formData.get("talla_campo") ?? "");
  if (tallaCampo) {
    const [{ data: campo }, { data: prod }] = await Promise.all([
      supabase.from("campos_linea").select("id").eq("id", tallaCampo).eq("tienda_id", tienda_id).single(),
      supabase.from("productos").select("atributos").eq("id", id).eq("tienda_id", tienda_id).single(),
    ]);
    if (campo && prod) {
      const atributos = { ...((prod.atributos as Record<string, unknown>) ?? {}) };
      const vals = String(formData.get("talla") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (vals.length === 0) delete atributos[campo.id];
      else atributos[campo.id] = vals.length > 1 ? vals : vals[0];
      patch.atributos = atributos;
    }
  }

  const { error } = await supabase
    .from("productos")
    .update(patch)
    .eq("id", id)
    .eq("tienda_id", tienda_id);
  if (error) return { ok: false, mensaje: error.message };
  revalidatePath("/admin/vista");
  revalidatePath("/admin/productos");
  return { ok: true, mensaje: "Guardado ✅" };
}

// Carga masiva: crea varios productos de golpe (desde un PDF).
// Nido: cada item trae nido_id (existente) o nido_nuevo=true; si hay nuevos,
// se crea UN nido (con nuevoNidoNombre) y todos esos productos van ahí.
export async function crearProductosImportados(
  formData: FormData,
): Promise<EstadoRapido> {
  const tienda_id = await tiendaDelAdmin();
  const supabase = await createClient();

  let payload: {
    nuevoNidoNombre?: string;
    items?: {
      nombre: string;
      precio: number;
      stock: number;
      genero: string | null;
      linea_id: string | null;
      nido_id: string | null;
      nido_nuevo: boolean;
      fotoPath: string | null;
      atributos?: Record<string, unknown>;
    }[];
  };
  try {
    payload = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { ok: false, mensaje: "Datos inválidos." };
  }
  const items = payload.items ?? [];
  if (items.length === 0) return { ok: false, mensaje: "No hay productos para cargar." };

  // Crea el nido nuevo si algún producto lo necesita.
  let nuevoNidoId: string | null = null;
  if (items.some((i) => i.nido_nuevo)) {
    const nombre = String(payload.nuevoNidoNombre ?? "").trim() || "Nuevo";
    const { count } = await supabase
      .from("nidos")
      .select("id", { count: "exact", head: true })
      .eq("tienda_id", tienda_id);
    const { data, error } = await supabase
      .from("nidos")
      .insert({
        tienda_id,
        nombre,
        fecha: new Date().toISOString().slice(0, 10),
        orden: (count ?? 0) + 1,
        es_nuevo: true,
        activo: true,
      })
      .select("id")
      .single();
    if (error) return { ok: false, mensaje: "No se pudo crear el nido nuevo: " + error.message };
    nuevoNidoId = data.id;
  }

  const rows = items.map((i) => ({
    tienda_id,
    nombre: String(i.nombre || "Producto").trim(),
    precio: Number(i.precio) || 0,
    costo: 0,
    cantidad: Number(i.stock) || 1,
    genero: i.genero || null,
    linea_id: i.linea_id || null,
    nido_id: i.nido_nuevo ? nuevoNidoId : i.nido_id || null,
    fotos: i.fotoPath ? [i.fotoPath] : [],
    atributos:
      i.atributos && typeof i.atributos === "object" && !Array.isArray(i.atributos)
        ? i.atributos
        : {},
    estado: "disponible" as const,
  }));

  const { error } = await supabase.from("productos").insert(rows);
  if (error) return { ok: false, mensaje: error.message };
  revalidatePath("/admin/productos");
  return { ok: true, mensaje: `Se cargaron ${rows.length} productos 🍯` };
}

// Duplica un producto (queda oculto para revisarlo antes de mostrarlo).
export async function duplicarProducto(formData: FormData) {
  const tienda_id = await tiendaDelAdmin();
  const supabase = await createClient();
  const id = String(formData.get("producto_id"));
  const { data: orig } = await supabase
    .from("productos")
    .select("*")
    .eq("id", id)
    .eq("tienda_id", tienda_id)
    .single();
  if (!orig) throw new Error("Producto no encontrado");

  const o = orig as Record<string, unknown>;
  const { error } = await supabase.from("productos").insert({
    tienda_id,
    nombre: `${o.nombre} (copia)`,
    descripcion: o.descripcion,
    linea_id: o.linea_id,
    nido_id: o.nido_id,
    costo: o.costo,
    precio: o.precio,
    precio_oferta: o.precio_oferta,
    cantidad: o.cantidad,
    categoria: o.categoria,
    genero: o.genero,
    fotos: o.fotos,
    atributos: o.atributos,
    oculto: true,
    estado: "disponible",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/productos");
}

// Oculta/muestra un producto en el catálogo público (sin borrarlo).
export async function alternarOculto(formData: FormData) {
  const tienda_id = await tiendaDelAdmin();
  const supabase = await createClient();
  const oculto = formData.get("oculto") === "true"; // estado actual
  const { error } = await supabase
    .from("productos")
    .update({ oculto: !oculto })
    .eq("id", String(formData.get("producto_id")))
    .eq("tienda_id", tienda_id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/productos");
}

// Guarda el orden manual de los productos (orden = posición en la lista).
export async function reordenarProductos(formData: FormData) {
  const tienda_id = await tiendaDelAdmin();
  const supabase = await createClient();
  let ids: string[] = [];
  try {
    ids = JSON.parse(String(formData.get("ids") ?? "[]"));
  } catch {
    ids = [];
  }
  await Promise.all(
    ids.map((id, i) =>
      supabase
        .from("productos")
        .update({ orden: i })
        .eq("id", id)
        .eq("tienda_id", tienda_id),
    ),
  );
  revalidatePath("/admin/productos");
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
