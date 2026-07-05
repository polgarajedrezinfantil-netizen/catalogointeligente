import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@/lib/supabase/server";
import { TEMA_DEFAULT } from "@/lib/tema";

// Favicon por tienda: la inicial de la marca sobre su paleta (el icono global
// del producto es la mascota de Mamielina y se filtraba a todas las tiendas).
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon({
  params,
}: {
  params: Promise<{ tienda: string }>;
}) {
  const { tienda: slug } = await params;

  // Mamielina conserva su mascota original (el icon.png global).
  if (slug === "mamielina") {
    const png = await readFile(path.join(process.cwd(), "app", "icon.png"));
    return new Response(new Uint8Array(png), {
      headers: { "Content-Type": "image/png" },
    });
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("tiendas")
    .select("nombre, tema")
    .eq("slug", slug)
    .eq("activa", true)
    .maybeSingle();

  const marca = String(data?.nombre ?? slug).split(" - ")[0].trim();
  const letra = (marca[0] ?? "?").toUpperCase();
  const tema = { ...TEMA_DEFAULT, ...((data?.tema as Record<string, string>) ?? {}) };

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: tema.crema,
          color: tema.coral,
          borderRadius: 7,
          fontSize: 25,
          fontWeight: 700,
        }}
      >
        {letra}
      </div>
    ),
    size,
  );
}
