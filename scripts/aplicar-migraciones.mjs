// Aplica migraciones a la BD dev o a producción.
//
//   node scripts/aplicar-migraciones.mjs dev  0029 0030 0031 0032 0033
//   node scripts/aplicar-migraciones.mjs prod 0032 0033
//
// Todas las migraciones del repo son idempotentes (create or replace,
// if not exists), así que repetir una es inofensivo.
import { execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import pg from "pg";

const ENTORNOS = {
  dev:  { host: "db.whyqdxwpqdmcpdvrfkke.supabase.co", llave: "supabase-catalogo-dev-db", nombre: "DEV (myelplay-agentes-dev)" },
  prod: { host: "db.nthbgrjfeorowimktbzy.supabase.co", llave: "supabase-catalogo-db",     nombre: "PRODUCCIÓN" },
};

const [entorno, ...numeros] = process.argv.slice(2);
const cfg = ENTORNOS[entorno];
if (!cfg || numeros.length === 0) {
  console.error("Uso: node scripts/aplicar-migraciones.mjs <dev|prod> 0032 0033 …");
  process.exit(1);
}

const todas = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
const archivos = numeros.map((n) => {
  const f = todas.find((a) => a.startsWith(n + "_"));
  if (!f) throw new Error(`No existe la migración ${n}`);
  return f;
});

const pass = execSync(`security find-generic-password -s ${cfg.llave} -w`).toString().trim();
const c = new pg.Client({
  host: cfg.host, port: 5432, user: "postgres", password: pass,
  database: "postgres", ssl: { rejectUnauthorized: false },
});

console.log(`→ ${cfg.nombre}: aplicando ${archivos.length} migración(es)\n`);
await c.connect();

for (const f of archivos) {
  const sql = readFileSync(`supabase/migrations/${f}`, "utf8");
  try {
    await c.query(sql);
    console.log(`   ✓ ${f}`);
  } catch (e) {
    console.error(`   ✗ ${f}\n     ${e.message}`);
    await c.end();
    process.exit(1);
  }
}

// Comprobación: que lo del CRM quedó realmente instalado.
const { rows: cols } = await c.query(
  `select column_name from information_schema.columns
    where table_schema='public' and table_name in ('clientes','pedidos')
      and column_name in ('etiquetas','nota','no_molestar','motivo','devuelto_en')`,
);
const { rows: fns } = await c.query(
  `select p.proname, pg_get_function_identity_arguments(p.oid) as args
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname in
      ('clientes_pagina','cliente_ficha','guardar_cliente_crm',
       'revertir_pago_pedido','devolver_pedido','cancelar_pedido')
    order by p.proname, args`,
);
const { rows: chk } = await c.query(
  `select pg_get_constraintdef(oid) as def from pg_constraint
    where conrelid='public.pedidos'::regclass and contype='c'
      and pg_get_constraintdef(oid) ilike '%estado%'`,
);

console.log("\n   columnas nuevas:", cols.map((r) => r.column_name).sort().join(", ") || "NINGUNA");
console.log("   funciones:");
for (const r of fns) console.log(`     · ${r.proname}(${r.args})`);
console.log("   estados de pedido:", chk[0]?.def ?? "sin check");

await c.end();
console.log("\nListo.");
