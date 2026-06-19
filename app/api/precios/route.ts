import { NextResponse } from "next/server";
import { getPerfil } from "@/lib/auth";

// Busca precios reales NUEVOS del producto vía SerpAPI (Google Shopping,
// que incluye resultados de Amazon y otras tiendas). Región México.
export async function POST(req: Request) {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { query } = (await req.json()) as { query: string };
  if (!query?.trim()) {
    return NextResponse.json({ error: "Falta la consulta" }, { status: 400 });
  }
  const key = process.env.SERPAPI_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "SERPAPI_KEY no configurada" },
      { status: 500 },
    );
  }

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_shopping");
  url.searchParams.set("q", query);
  url.searchParams.set("gl", "mx");
  url.searchParams.set("hl", "es");
  url.searchParams.set("api_key", key);

  try {
    const r = await fetch(url, { cache: "no-store" });
    const j = await r.json();
    type SR = {
      title?: string;
      price?: string;
      extracted_price?: number;
      source?: string;
      link?: string;
      product_link?: string;
      thumbnail?: string;
    };
    const precios = ((j.shopping_results as SR[]) ?? [])
      .slice(0, 12)
      .map((s) => ({
        titulo: s.title ?? "",
        precio: s.extracted_price ?? null,
        precio_txt: s.price ?? "",
        fuente: s.source ?? "",
        link: s.product_link ?? s.link ?? "",
        thumbnail: s.thumbnail ?? "",
      }))
      .filter((p) => p.titulo);

    // Estadísticas útiles para fijar el precio de venta.
    const nums = precios
      .map((p) => p.precio)
      .filter((n): n is number => typeof n === "number");
    const stats =
      nums.length > 0
        ? {
            min: Math.min(...nums),
            max: Math.max(...nums),
            promedio: Math.round(nums.reduce((a, b) => a + b, 0) / nums.length),
          }
        : null;

    return NextResponse.json({ precios, stats });
  } catch (e) {
    const detalle = e instanceof Error ? e.message : "Error de búsqueda";
    return NextResponse.json({ error: detalle }, { status: 500 });
  }
}
