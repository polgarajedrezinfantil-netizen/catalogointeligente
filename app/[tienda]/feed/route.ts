/**
 * Feed de catálogo para Meta (Facebook/Instagram Shopping + catálogo dinámico).
 *
 * URL:  https://<tienda>.myelplay.com/<slug>/feed        → CSV (por defecto)
 *       …/<slug>/feed?format=xml                          → XML (RSS 2.0 g:)
 *
 * Es DINÁMICO: se genera en vivo desde Supabase cada vez que Meta lo lee, así
 * que refleja el stock actual sin subir archivos. Pega esta URL en:
 *   Meta Commerce Manager → Catálogo → Fuentes de datos → Feed programado.
 *
 * Campos obligatorios de Meta: id, title, description, availability, condition,
 * price, link, image_link, brand. Se agregan los opcionales útiles para ropa
 * infantil: sale_price, gender, age_group, product_type, custom_label_0
 * (colección/Nido), color, size y additional_image_link.
 *
 * IMPORTANTE (retargeting dinámico): el `id` de cada producto aquí es el mismo
 * uuid que el píxel manda en content_ids (ViewContent/AddToCart), para que Meta
 * empareje el producto visto con el del catálogo.
 */
import { createServiceClient } from "@/lib/supabase/service";
import { urlFoto } from "@/lib/fotos";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Row = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  precio_oferta: number | null;
  fotos: string[] | null;
  categoria: string | null;
  genero: "nino" | "nina" | "unisex" | "mami" | null;
  estado: string;
  nido_id: string | null;
  linea_id: string | null;
  atributos: Record<string, unknown> | null;
};

const CAMPOS = [
  "id", "title", "description", "availability", "condition", "price", "sale_price",
  "link", "image_link", "additional_image_link", "brand", "product_type",
  "google_product_category", "custom_label_0", "gender", "age_group", "color", "size",
];

function esc(v: string): string {
  // CSV: comillas dobles, saltos de línea y comas → entre comillas, escapando ".
  const s = (v ?? "").toString().replace(/\r?\n/g, " ").trim();
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function xmlEsc(v: string): string {
  return (v ?? "").toString()
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// estado del producto → disponibilidad de Meta
function disponibilidad(estado: string): string {
  return estado === "disponible" ? "in stock" : "out of stock";
}

// genero interno → gender + age_group de Meta
function generoMeta(g: string | null): { gender?: string; age_group?: string } {
  switch (g) {
    case "nina": return { gender: "female", age_group: "kids" };
    case "nino": return { gender: "male", age_group: "kids" };
    case "unisex": return { gender: "unisex", age_group: "kids" };
    case "mami": return { gender: "female", age_group: "adult" };
    default: return {};
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tienda: string }> },
) {
  const { tienda: slug } = await params;
  const url = new URL(req.url);
  const formato = url.searchParams.get("format") === "xml" ? "xml" : "csv";
  const origin = url.origin; // https://<subdominio>.myelplay.com

  const supabase = createServiceClient();

  const { data: tienda } = await supabase
    .from("tiendas")
    .select("id, nombre, moneda, activa")
    .eq("slug", slug)
    .eq("activa", true)
    .maybeSingle();
  if (!tienda) return new Response("Tienda no encontrada", { status: 404 });

  const marca = String(tienda.nombre).split(" - ")[0].trim();
  const moneda = (tienda.moneda || "MXN").toUpperCase();

  const { data: productos } = await supabase
    .from("productos")
    .select("id,nombre,descripcion,precio,precio_oferta,fotos,categoria,genero,estado,nido_id,linea_id,atributos")
    .eq("tienda_id", tienda.id)
    .eq("oculto", false)
    .order("orden", { ascending: true });

  // Nidos (colección) → custom_label_0.
  const { data: nidos } = await supabase
    .from("nidos").select("id,nombre").eq("tienda_id", tienda.id);
  const nidoNombre = new Map<string, string>((nidos || []).map((n) => [n.id, n.nombre]));

  // Campos de color/talla (por nombre) para leer atributos por campo_id.
  const { data: campos } = await supabase
    .from("campos_linea").select("id,nombre").eq("tienda_id", tienda.id);
  const campoColor = (campos || []).find((c) => /color/i.test(c.nombre))?.id;
  const campoTalla = (campos || []).find((c) => /talla|tama|size/i.test(c.nombre))?.id;

  const items = (productos as Row[] | null) || [];

  function precioTxt(n: number): string {
    return `${Number(n).toFixed(2)} ${moneda}`;
  }
  function attrTxt(attrs: Record<string, unknown> | null, campoId?: string): string {
    if (!attrs || !campoId) return "";
    const v = attrs[campoId];
    if (v == null) return "";
    if (Array.isArray(v)) return v.join(", ");
    return String(v);
  }

  function fila(p: Row): Record<string, string> {
    const fotos = Array.isArray(p.fotos) ? p.fotos : [];
    const img = fotos[0] ? urlFoto(fotos[0]) : "";
    const extra = fotos.slice(1, 11).map((f) => urlFoto(f)).filter(Boolean).join(",");
    const g = generoMeta(p.genero);
    const desc = (p.descripcion && p.descripcion.trim())
      || `${p.nombre}${marca ? " · " + marca : ""}`;
    const f: Record<string, string> = {
      id: p.id,
      title: p.nombre.slice(0, 200),
      description: desc.slice(0, 5000),
      availability: disponibilidad(p.estado),
      condition: "new",
      price: precioTxt(p.precio),
      sale_price: p.precio_oferta != null ? precioTxt(p.precio_oferta) : "",
      link: `${origin}/p/${p.id}`,
      image_link: img,
      additional_image_link: extra,
      brand: marca || "Mamielina",
      product_type: p.categoria || "",
      google_product_category: "", // opcional: se puede mapear después
      custom_label_0: p.nido_id ? (nidoNombre.get(p.nido_id) || "") : "",
      gender: g.gender || "",
      age_group: g.age_group || "",
      color: attrTxt(p.atributos, campoColor),
      size: attrTxt(p.atributos, campoTalla),
    };
    return f;
  }

  // Un producto es válido para el feed si tiene los obligatorios mínimos.
  const validos = items.filter((p) => p.nombre && p.precio > 0 && (p.fotos?.[0]));

  if (formato === "xml") {
    const body = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
      `<channel><title>${xmlEsc(marca)}</title><link>${origin}/${slug}</link>`,
      `<description>Catálogo de ${xmlEsc(marca)}</description>`,
      ...validos.map((p) => {
        const f = fila(p);
        const tag = (k: string) => (f[k] ? `<g:${k}>${xmlEsc(f[k])}</g:${k}>` : "");
        return "<item>" + [
          "id", "title", "description", "availability", "condition", "price", "sale_price",
          "link", "image_link", "additional_image_link", "brand", "product_type",
          "custom_label_0", "gender", "age_group", "color", "size",
        ].map(tag).join("") + "</item>";
      }),
      "</channel></rss>",
    ].join("\n");
    return new Response(body, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  // CSV (por defecto)
  const lineas = [CAMPOS.join(",")];
  for (const p of validos) {
    const f = fila(p);
    lineas.push(CAMPOS.map((c) => esc(f[c] || "")).join(","));
  }
  return new Response("﻿" + lineas.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `inline; filename="${slug}-feed.csv"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
