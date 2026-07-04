import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Tema } from "@/lib/tema";

// Subdominios que NO son tiendas (dominio del producto/operador o técnico).
export const SUBDOMINIOS_NEUTROS = new Set(["agentes", "app", "www", "localhost"]);

export type TiendaDeHost = {
  slug: string;
  nombre: string; // nombre corto (antes de " - ")
  logo_url: string | null;
  tema: Tema | null;
};

/**
 * Resuelve la tienda dueña del host actual: en <tienda>.myelplay.com devuelve
 * esa tienda (para vestir landing/login/metadata con SU marca); en el dominio
 * del producto (agentes.*), en localhost o en dominios técnicos devuelve null
 * (branding neutro "MyelPlay Agentes").
 */
export async function tiendaPorHost(): Promise<TiendaDeHost | null> {
  const h = await headers();
  const host = (h.get("host") ?? "").split(":")[0].toLowerCase();
  const slug = host.split(".")[0];
  if (!slug || !host.includes(".") || SUBDOMINIOS_NEUTROS.has(slug)) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("tiendas")
    .select("slug, nombre, logo_url, tema")
    .eq("slug", slug)
    .eq("activa", true)
    .maybeSingle();
  if (!data) return null;

  return {
    slug: data.slug as string,
    nombre: String(data.nombre).split(" - ")[0],
    logo_url: (data.logo_url as string | null) ?? null,
    tema: (data.tema as Tema | null) ?? null,
  };
}
