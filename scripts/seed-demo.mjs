// Seed de datos demo para la prueba visual.
// Crea una tienda "Mamielina Demo" (slug: mamielina), siembra líneas+campos,
// sube fotos reales al Storage y crea un Nido con productos.
// Uso: node scripts/seed-demo.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Cargar .env.local
const env = {};
for (const l of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const SLUG = "mamielina";

async function subirFoto(tiendaId, semilla) {
  // Imagen real de placeholder (Picsum), subida al bucket 'fotos'.
  const res = await fetch(`https://picsum.photos/seed/${semilla}/700/700`);
  const buf = Buffer.from(await res.arrayBuffer());
  const path = `${tiendaId}/seed/${semilla}.jpg`;
  await supabase.storage.from("fotos").upload(path, buf, {
    contentType: "image/jpeg",
    upsert: true,
  });
  return path;
}

async function main() {
  // 1) Tienda
  let { data: tienda } = await supabase.from("tiendas").select("*").eq("slug", SLUG).maybeSingle();
  if (!tienda) {
    const { data, error } = await supabase
      .from("tiendas")
      .insert({ nombre: "Mamielina Demo", slug: SLUG, plan_clave: "pro", whatsapp: "5215555555555" })
      .select("*")
      .single();
    if (error) throw error;
    tienda = data;
    await supabase.rpc("sembrar_lineas_demo", { p_tienda: tienda.id });
    console.log("✓ Tienda demo creada:", tienda.id);
  } else {
    console.log("• Tienda demo ya existe:", tienda.id);
  }
  const T = tienda.id;

  // 2) Líneas + campos
  const { data: lineas } = await supabase.from("lineas_de_venta").select("*").eq("tienda_id", T);
  const { data: campos } = await supabase.from("campos_linea").select("*").eq("tienda_id", T);
  const linea = (n) => lineas.find((l) => l.nombre === n);
  const campo = (lineaNom, campoNom) =>
    campos.find((c) => c.linea_id === linea(lineaNom)?.id && c.nombre === campoNom)?.id;

  // 3) Nido (si no hay)
  let { data: nidos } = await supabase.from("nidos").select("id").eq("tienda_id", T);
  let nidoId;
  if (!nidos || nidos.length === 0) {
    const portada = await subirFoto(T, "nido-primavera");
    const { data } = await supabase
      .from("nidos")
      .insert({ tienda_id: T, nombre: "Primavera 2026", foto_portada_url: portada, es_nuevo: true })
      .select("id")
      .single();
    nidoId = data.id;
    console.log("✓ Nido creado");
  } else {
    nidoId = nidos[0].id;
    console.log("• Nido ya existe");
  }

  // 4) Productos (2 por línea) con fotos + atributos
  const { count } = await supabase
    .from("productos")
    .select("id", { count: "exact", head: true })
    .eq("tienda_id", T);
  if ((count ?? 0) > 0) {
    console.log("• Productos ya existen, no se duplican.");
    console.log(`\nListo. Abre:  /${SLUG}`);
    return;
  }

  const defs = [
    { l: "Ropa", nombre: "Vestido piñas", costo: 60, precio: 120, attrs: { Talla: "2", Color: "Amarillo", Edad: "Niño pequeño" } },
    { l: "Ropa", nombre: "Mameluco nube", costo: 70, precio: 145, attrs: { Talla: "6-12m", Color: "Crema", Edad: "Bebé" } },
    { l: "Calzado", nombre: "Tenis arcoíris", costo: 90, precio: 180, attrs: { Número: "23", Color: "Multicolor" } },
    { l: "Calzado", nombre: "Botitas miel", costo: 110, precio: 210, attrs: { Número: "25", Color: "Café" } },
    { l: "Varios", nombre: "Sonaja abeja", costo: 30, precio: 75, attrs: { Material: "Algodón", Medidas: "12 cm" } },
    { l: "Varios", nombre: "Manta nubes", costo: 80, precio: 160, attrs: { Material: "Bambú", Medidas: "90×90 cm" } },
  ];

  for (let i = 0; i < defs.length; i++) {
    const d = defs[i];
    const foto = await subirFoto(T, `prod-${i}`);
    const atributos = {};
    for (const [k, v] of Object.entries(d.attrs)) {
      const id = campo(d.l, k);
      if (id) atributos[id] = v;
    }
    await supabase.from("productos").insert({
      tienda_id: T,
      linea_id: linea(d.l).id,
      nido_id: nidoId,
      nombre: d.nombre,
      costo: d.costo,
      precio: d.precio,
      cantidad: 1,
      fotos: [foto],
      atributos,
    });
    console.log(`✓ Producto: ${d.nombre}`);
  }

  console.log(`\n🍯 Listo. Catálogo:  http://localhost:3000/${SLUG}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
