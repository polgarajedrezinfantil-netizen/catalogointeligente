// Carga 2 Nidos demo con 25 productos cada uno en la tienda "mamielina".
// Uso: node scripts/seed-grande.mjs
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
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (arr) => arr[rnd(0, arr.length - 1)];

const DEFS = {
  Ropa: {
    nombres: ["Vestido", "Conjunto", "Mameluco", "Body", "Sudadera", "Playera", "Short", "Pantalón", "Falda", "Overol"],
    extra: ["piñas", "nubes", "rayas", "flores", "estrellas", "corazones", "lunares"],
    colores: ["Rosa", "Azul", "Verde", "Amarillo", "Crema", "Gris"],
    tallas: ["0-3m", "3-6m", "6-12m", "1", "2", "3", "4", "5"],
    edades: ["Recién nacido", "Bebé", "Niño pequeño", "Niño"],
  },
  Calzado: {
    nombres: ["Tenis", "Botitas", "Sandalias", "Pantuflas", "Zapatos"],
    extra: ["arcoíris", "miel", "luces", "suaves", "antiderrapantes"],
    colores: ["Negro", "Café", "Blanco", "Rosa", "Azul", "Multicolor"],
  },
  Varios: {
    nombres: ["Sonaja", "Manta", "Mordedera", "Gorro", "Juguete", "Babero", "Móvil"],
    extra: ["abeja", "nubes", "conejo", "osito", "estrella"],
    materiales: ["Algodón", "Bambú", "Felpa", "Silicona"],
  },
};

async function subir(semilla) {
  const res = await fetch(`https://picsum.photos/seed/${semilla}/500/500`);
  const buf = Buffer.from(await res.arrayBuffer());
  const path = `seed-grande/${semilla}.jpg`;
  // tienda_id se antepone abajo
  return { buf, path };
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

  // Sube 12 imágenes compartidas (más rápido que 50 distintas).
  console.log("Subiendo imágenes demo…");
  const fotos = [];
  for (let i = 0; i < 12; i++) {
    const res = await fetch(`https://picsum.photos/seed/grande-${i}/500/500`);
    const buf = Buffer.from(await res.arrayBuffer());
    const path = `${T}/seed-grande/${i}.jpg`;
    await sb.storage.from("fotos").upload(path, buf, { contentType: "image/jpeg", upsert: true });
    fotos.push(path);
  }

  const nidos = ["Verano 2026", "Otoño 2026"];
  for (const nombreNido of nidos) {
    // Evita duplicar si ya existe
    let { data: existe } = await sb.from("nidos").select("id").eq("tienda_id", T).eq("nombre", nombreNido).maybeSingle();
    let nidoId;
    if (existe) {
      nidoId = existe.id;
      console.log(`• Nido "${nombreNido}" ya existe, reusando.`);
    } else {
      const portada = fotos[rnd(0, fotos.length - 1)];
      const { data } = await sb
        .from("nidos")
        .insert({ tienda_id: T, nombre: nombreNido, foto_portada_url: portada, es_nuevo: true })
        .select("id")
        .single();
      nidoId = data.id;
      console.log(`✓ Nido "${nombreNido}" creado.`);
    }

    const productos = [];
    for (let i = 0; i < 25; i++) {
      const linNom = pick(["Ropa", "Calzado", "Varios"]);
      const d = DEFS[linNom];
      const nombre = `${pick(d.nombres)} ${pick(d.extra)}`;
      const costo = rnd(30, 150);
      const precio = Math.round(costo * (1.4 + Math.random() * 0.6));
      const atributos = {};
      if (linNom === "Ropa") {
        atributos[campoId("Ropa", "Talla")] = pick(d.tallas);
        atributos[campoId("Ropa", "Color")] = pick(d.colores);
        atributos[campoId("Ropa", "Edad")] = pick(d.edades);
      } else if (linNom === "Calzado") {
        atributos[campoId("Calzado", "Número")] = String(rnd(18, 27));
        atributos[campoId("Calzado", "Color")] = pick(d.colores);
      } else {
        atributos[campoId("Varios", "Material")] = pick(d.materiales);
        atributos[campoId("Varios", "Medidas")] = `${rnd(10, 90)} cm`;
      }
      const f1 = fotos[rnd(0, fotos.length - 1)];
      const f2 = fotos[rnd(0, fotos.length - 1)];
      productos.push({
        tienda_id: T,
        linea_id: linea(linNom).id,
        nido_id: nidoId,
        nombre,
        costo,
        precio,
        cantidad: rnd(1, 4),
        fotos: [f1, f2],
        atributos,
      });
    }
    const { error } = await sb.from("productos").insert(productos);
    if (error) throw error;
    console.log(`  ✓ 25 productos agregados a "${nombreNido}".`);
  }

  const { count } = await sb.from("productos").select("id", { count: "exact", head: true }).eq("tienda_id", T);
  console.log(`\n🍯 Listo. Total de productos en la tienda demo: ${count}`);
  console.log(`Catálogo: http://localhost:3001/${SLUG}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
