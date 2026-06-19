// Deja en la tienda demo SOLO el Nido cargado del PDF ("Catálogo 0-24 meses").
// Borra los Nidos demo (Primavera/Verano/Otoño) con sus productos y pone el
// tiempo de apartado por defecto en 1 hora.
// Uso: node scripts/limpiar-demos.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const l of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const SLUG = "mamielina";
const CONSERVAR = "Catálogo 0-24 meses";

async function main() {
  const { data: tienda } = await sb.from("tiendas").select("id,hold_horas").eq("slug", SLUG).single();
  if (!tienda) throw new Error("No existe la tienda demo.");
  const T = tienda.id;

  // 1) Nidos a borrar = todos menos el del PDF.
  const { data: nidos } = await sb.from("nidos").select("id,nombre").eq("tienda_id", T);
  const borrar = (nidos ?? []).filter((n) => n.nombre !== CONSERVAR);
  const ids = borrar.map((n) => n.id);

  if (ids.length > 0) {
    // Borra primero los productos de esos nidos (lista_espera cae por cascade).
    const { error: pe, count } = await sb
      .from("productos")
      .delete({ count: "exact" })
      .in("nido_id", ids);
    if (pe) throw pe;
    const { error: ne } = await sb.from("nidos").delete().in("id", ids);
    if (ne) throw ne;
    console.log(`✓ Borrados ${borrar.length} Nidos demo (${borrar.map((n) => n.nombre).join(", ")}) y ${count} productos.`);
  } else {
    console.log("• No había Nidos demo extra que borrar.");
  }

  // 2) Tiempo de apartado por defecto = 1 hora.
  const { error: te } = await sb.from("tiendas").update({ hold_horas: 1 }).eq("id", T);
  if (te) throw te;
  console.log("✓ Tiempo de apartado puesto en 1 hora.");

  // Resumen
  const { data: quedan } = await sb.from("nidos").select("nombre").eq("tienda_id", T);
  const { count } = await sb.from("productos").select("id", { count: "exact", head: true }).eq("tienda_id", T);
  console.log(`\n🍯 Quedan: ${quedan.map((n) => n.nombre).join(", ")} | ${count} productos.`);
}

main().catch((e) => {
  console.error("\n", e);
  process.exit(1);
});
