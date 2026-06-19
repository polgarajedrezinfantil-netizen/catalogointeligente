// Crea el Nido "Catálogo 0-24 meses" en la tienda demo (slug: mamielina)
// a partir del PDF real de MAMIELINA. Recorta la foto de cada producto de
// las páginas renderizadas y la sube al Storage.
//
// Requisitos previos (ya corridos por el asistente):
//   pdftoppm -png -r 150 "Catálogo 0-24 meses.pdf" /tmp/pdfx/pg
// Uso:  node scripts/seed-pdf.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const env = {};
for (const l of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const SLUG = "mamielina";
const NIDO = "Catálogo 0-24 meses";
const PG = "/tmp/pdfx"; // páginas renderizadas: pg-01.png … pg-17.png

// Cada producto define la página y la región (fracciones 0–1: izq, arriba, ancho, alto)
// de donde recortar su foto real del catálogo.
const T_TOP = [0.03, 0.06, 0.94, 0.45];
const T_BOT = [0.03, 0.51, 0.94, 0.46];

const PRODUCTOS = [
  // pág, región, línea, nombre, precio, atributos
  { pg: 3,  r: T_TOP, l: "Ropa", nombre: "Pañalero estrellas", precio: 200, a: { Talla: "0-3m" } },
  { pg: 3,  r: T_BOT, l: "Ropa", nombre: "Pañalero Tommy", precio: 150, a: { Talla: "0-3m" } },
  { pg: 4,  r: T_TOP, l: "Ropa", nombre: "Playera Bambi", precio: 150, a: { Talla: "0-3m" } },
  { pg: 4,  r: T_BOT, l: "Ropa", nombre: "Suéter Oh Boy", precio: 150, a: { Talla: "0-3m" } },
  { pg: 5,  r: T_TOP, l: "Ropa", nombre: "Pañalero Nike", precio: 250, a: { Talla: "0-6m" } },
  { pg: 5,  r: T_BOT, l: "Ropa", nombre: "Nike 2 Piece Set", precio: 150, a: { Talla: "0-6m" } },
  { pg: 6,  r: T_TOP, l: "Ropa", nombre: "Conjunto 2 pzs", precio: 200, a: { Talla: "6m" } },
  { pg: 6,  r: T_BOT, l: "Ropa", nombre: "Conjunto 2 pzs Ocean", precio: 200, a: { Talla: "3m" } },
  { pg: 7,  r: T_TOP, l: "Ropa", nombre: "Play Wakanda", precio: 130, a: { Talla: "12m" } },
  { pg: 7,  r: T_BOT, l: "Ropa", nombre: "Organic Bear", precio: 120, a: { Talla: "3-6m" } },
  { pg: 8,  r: T_TOP, l: "Ropa", nombre: "Playera Rayas", precio: 100, a: { Talla: "12m" } },
  { pg: 8,  r: T_BOT, l: "Ropa", nombre: "Playera mel", precio: 80, a: { Talla: "3m" } },
  { pg: 10, r: T_TOP, l: "Ropa", nombre: "Pink carrot", precio: 200, a: { Talla: "6m", Color: "Rosa" } },
  { pg: 10, r: T_BOT, l: "Ropa", nombre: "Blusa picblue", precio: 200, a: { Talla: "18-24m", Color: "Azul" } },
  { pg: 11, r: T_TOP, l: "Ropa", nombre: "Confeti corazón", precio: 100, a: { Talla: "18m" } },
  { pg: 11, r: T_BOT, l: "Ropa", nombre: "Pañalero rosa", precio: 130, a: { Talla: "3-6m", Color: "Rosa" } },
  { pg: 12, r: T_TOP, l: "Ropa", nombre: "Pañalero rosa flechas", precio: 100, a: { Talla: "6m", Color: "Rosa" } },
  { pg: 12, r: T_BOT, l: "Ropa", nombre: "Vestido flores", precio: 200, a: { Talla: "12m" } },
  { pg: 13, r: T_TOP, l: "Ropa", nombre: "Pañalero flores", precio: 120, a: { Talla: "9m" } },
  { pg: 13, r: T_BOT, l: "Ropa", nombre: "Overol beige", precio: 120, a: { Talla: "12-18m", Color: "Crema" } },
  { pg: 14, r: T_TOP, l: "Ropa", nombre: "Overol verde", precio: 200, a: { Talla: "6-9m", Color: "Verde" } },
  { pg: 14, r: T_BOT, l: "Ropa", nombre: "Blusa corazón flores", precio: 130, a: { Talla: "18m" } },
  { pg: 15, r: T_TOP, l: "Ropa", nombre: "Suéter gris", precio: 200, a: { Talla: "12m", Color: "Gris" } },
  { pg: 15, r: T_BOT, l: "Ropa", nombre: "Vestido mariposas", precio: 160, a: { Talla: "12-18m" } },
  // Página 16: tres leggings
  { pg: 16, r: [0.0, 0.03, 0.55, 0.42], l: "Ropa", nombre: "Leggings durazno", precio: 130, a: { Talla: "6-18m", Color: "Durazno" } },
  { pg: 16, r: [0.0, 0.40, 0.52, 0.46], l: "Ropa", nombre: "Leggings Baby Gap", precio: 130, a: { Talla: "6-12m", Color: "Crema" } },
  { pg: 16, r: [0.45, 0.42, 0.55, 0.52], l: "Ropa", nombre: "Leggings flores", precio: 130, a: { Talla: "12-18m" } },
  // Página 17: accesorios y calzado
  { pg: 17, r: [0.02, 0.04, 0.46, 0.33], l: "Varios", nombre: "Fular MOBY", precio: 280, a: { Material: "Algodón" } },
  { pg: 17, r: [0.50, 0.03, 0.48, 0.33], l: "Calzado", nombre: "Zapatos durazno", precio: 120, a: { Color: "Durazno" } },
  { pg: 17, r: [0.0, 0.52, 0.42, 0.34], l: "Calzado", nombre: "Botitas dino verde", precio: 150, a: { Color: "Verde" } },
  { pg: 17, r: [0.55, 0.52, 0.44, 0.36], l: "Calzado", nombre: "Zapatos amarillos", precio: 120, a: { Color: "Amarillo" } },
  { pg: 17, r: [0.30, 0.66, 0.40, 0.33], l: "Varios", nombre: "Casco protector bebé", precio: 150, a: { Material: "Tela" } },
];

// Recorta la región de una página y devuelve un JPEG listo para subir.
async function recortar(pg, r) {
  const file = `${PG}/pg-${String(pg).padStart(2, "0")}.png`;
  const meta = await sharp(file).metadata();
  const W = meta.width, H = meta.height;
  let left = Math.round(r[0] * W);
  let top = Math.round(r[1] * H);
  let width = Math.round(r[2] * W);
  let height = Math.round(r[3] * H);
  // Clamp a los límites de la página.
  width = Math.min(width, W - left);
  height = Math.min(height, H - top);
  return sharp(file)
    .extract({ left, top, width, height })
    .resize({ width: 900, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
}

async function main() {
  const { data: tienda } = await sb.from("tiendas").select("id").eq("slug", SLUG).single();
  if (!tienda) throw new Error("No existe la tienda demo. Corre antes seed-demo.mjs.");
  const T = tienda.id;

  const { data: lineas } = await sb.from("lineas_de_venta").select("*").eq("tienda_id", T);
  const { data: campos } = await sb.from("campos_linea").select("*").eq("tienda_id", T);
  const linea = (n) => lineas.find((l) => l.nombre === n);
  const campoId = (lineaNom, campoNom) =>
    campos.find((c) => c.linea_id === linea(lineaNom)?.id && c.nombre === campoNom)?.id;

  // Nido (reusar si existe)
  let { data: existe } = await sb
    .from("nidos").select("id").eq("tienda_id", T).eq("nombre", NIDO).maybeSingle();
  let nidoId;
  if (existe) {
    nidoId = existe.id;
    const { count } = await sb
      .from("productos").select("id", { count: "exact", head: true }).eq("nido_id", nidoId);
    if ((count ?? 0) > 0) {
      console.log(`• El Nido "${NIDO}" ya tiene productos (${count}). No se duplica.`);
      console.log(`Catálogo: ${env.NEXT_PUBLIC_SUPABASE_URL ? "" : ""}/${SLUG}`);
      return;
    }
    console.log(`• Nido "${NIDO}" existe sin productos, se llenará.`);
  } else {
    console.log("Subiendo portada…");
    const portadaBuf = await sharp(`${PG}/pg-01.png`).resize({ width: 900 }).jpeg({ quality: 82 }).toBuffer();
    const portadaPath = `${T}/pdf/portada.jpg`;
    await sb.storage.from("fotos").upload(portadaPath, portadaBuf, { contentType: "image/jpeg", upsert: true });
    const { data, error } = await sb
      .from("nidos")
      .insert({ tienda_id: T, nombre: NIDO, foto_portada_url: portadaPath, es_nuevo: true })
      .select("id").single();
    if (error) throw error;
    nidoId = data.id;
    console.log(`✓ Nido "${NIDO}" creado.`);
  }

  const filas = [];
  for (let i = 0; i < PRODUCTOS.length; i++) {
    const p = PRODUCTOS[i];
    process.stdout.write(`  recortando ${i + 1}/${PRODUCTOS.length} (${p.nombre})…\r`);
    const buf = await recortar(p.pg, p.r);
    const path = `${T}/pdf/${i}-${p.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.jpg`;
    const { error: upErr } = await sb.storage.from("fotos").upload(path, buf, { contentType: "image/jpeg", upsert: true });
    if (upErr) throw upErr;

    const atributos = {};
    for (const [k, v] of Object.entries(p.a)) {
      const id = campoId(p.l, k);
      if (id) atributos[id] = v;
    }
    filas.push({
      tienda_id: T,
      linea_id: linea(p.l).id,
      nido_id: nidoId,
      nombre: p.nombre,
      costo: Math.round(p.precio * 0.55),
      precio: p.precio,
      cantidad: 1,
      fotos: [path],
      atributos,
    });
  }

  const { error } = await sb.from("productos").insert(filas);
  if (error) throw error;
  console.log(`\n✓ ${filas.length} productos creados en "${NIDO}".`);
  console.log(`\n🍯 Listo. Catálogo:  /${SLUG}`);
}

main().catch((e) => {
  console.error("\n", e);
  process.exit(1);
});
