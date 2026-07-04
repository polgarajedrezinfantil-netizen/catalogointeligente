import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { urlFoto } from "@/lib/fotos";
import type { Tema } from "@/lib/tema";
import LoginCliente, { type MarcaLogin } from "./LoginCliente";

// Subdominios que NO son tiendas (dominio del producto/operador o técnico).
const SUBDOMINIOS_NEUTROS = new Set(["agentes", "app", "www", "localhost"]);

/**
 * Resuelve la marca del login por subdominio: en <tienda>.myelplay.com el
 * login viste la marca de esa tienda (logo, nombre, paleta); en el dominio
 * del producto (agentes.*), en localhost o en dominios técnicos queda el
 * diseño neutro "MyelPlay Agentes".
 */
async function marcaPorHost(): Promise<MarcaLogin> {
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
    slug: data.slug,
    nombre: data.nombre.split(" - ")[0],
    logoUrl: data.logo_url ? urlFoto(data.logo_url) : null,
    tema: (data.tema as Tema) ?? null,
  };
}

export default async function LoginPage() {
  const marca = await marcaPorHost();
  return <LoginCliente marca={marca} />;
}
