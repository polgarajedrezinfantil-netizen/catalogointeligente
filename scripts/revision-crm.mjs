// Radiografía del CRM en una BD: qué hay instalado y cuánto dato mueve.
// Solo lee; no modifica nada.
//
//   node scripts/revision-crm.mjs dev
//   node scripts/revision-crm.mjs prod
import { execSync } from "node:child_process";
import pg from "pg";

const ENTORNOS = {
  dev:  { host: "db.whyqdxwpqdmcpdvrfkke.supabase.co", llave: "supabase-catalogo-dev-db", nombre: "DEV" },
  prod: { host: "db.nthbgrjfeorowimktbzy.supabase.co", llave: "supabase-catalogo-db",     nombre: "PRODUCCIÓN" },
};

const cfg = ENTORNOS[process.argv[2]];
if (!cfg) {
  console.error("Uso: node scripts/revision-crm.mjs <dev|prod>");
  process.exit(1);
}

const pass = execSync(`security find-generic-password -s ${cfg.llave} -w`).toString().trim();
const c = new pg.Client({
  host: cfg.host, port: 5432, user: "postgres", password: pass,
  database: "postgres", ssl: { rejectUnauthorized: false },
});
await c.connect();
console.log(`\n=== ${cfg.nombre} ===\n`);

const { rows: tiendas } = await c.query("select slug, nombre from public.tiendas order by creado");
console.log("Tiendas:", tiendas.map((t) => t.slug).join(", ") || "ninguna");

console.log("\nVolumen:");
for (const tb of ["clientes", "pedidos", "eventos_cliente", "eventos_apartado", "solicitudes_cliente", "mensajes", "productos"]) {
  const { rows } = await c.query(`select count(*)::int n from public.${tb}`);
  console.log("  " + tb.padEnd(22), rows[0].n.toLocaleString("es-MX"));
}

const { rows: est } = await c.query("select estado, count(*)::int n from public.pedidos group by estado order by n desc");
console.log("\nPedidos por estado:", est.map((e) => `${e.estado}=${e.n}`).join(" · ") || "sin pedidos");

const { rows: cols } = await c.query(
  `select table_name, column_name from information_schema.columns
    where table_schema='public'
      and (   (table_name='clientes' and column_name in ('etiquetas','nota','no_molestar','etapa','etapa_manual','proximo_seguimiento','seguimiento_nota','responsable'))
           or (table_name='pedidos'  and column_name in ('motivo','devuelto_en','actualizado'))
           or (table_name='tiendas'  and column_name in ('zona_horaria')))
    order by table_name, column_name`,
);
console.log("\nColumnas del CRM instaladas:");
if (cols.length === 0) console.log("  ninguna");
for (const r of cols) console.log(`  · ${r.table_name}.${r.column_name}`);

const { rows: fns } = await c.query(
  `select p.proname, pg_get_function_identity_arguments(p.oid) as args
     from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in
      ('clientes_pagina','cliente_ficha','guardar_cliente_crm','guardar_seguimiento_cliente',
       'guardar_etapa_cliente','recalcular_etapa_cliente','hoy_tienda',
       'revertir_pago_pedido','devolver_pedido','cancelar_pedido','confirmar_pedido')
    order by p.proname, args`,
);
console.log("\nFunciones:");
if (fns.length === 0) console.log("  ninguna");
for (const r of fns) console.log(`  · ${r.proname}(${r.args})`);

const { rows: trg } = await c.query(
  `select tgname, c.relname from pg_trigger t join pg_class c on c.oid=t.tgrelid
    where not t.tgisinternal and tgname like 'trg_cli_etapa%' order by tgname`,
);
console.log("\nDisparadores de etapa:", trg.length ? trg.map((r) => `${r.tgname}@${r.relname}`).join(", ") : "ninguno");

const { rows: chk } = await c.query(
  `select pg_get_constraintdef(oid) as def from pg_constraint
    where conrelid='public.pedidos'::regclass and contype='c'
      and pg_get_constraintdef(oid) ilike '%estado%'`,
);
console.log("Estados de pedido permitidos:", chk[0]?.def ?? "sin check");

const { rows: etapas } = await c.query(
  `select etapa, count(*)::int n from public.clientes group by etapa order by n desc`,
).catch(() => ({ rows: [] }));
if (etapas.length) console.log("\nClientes por etapa:", etapas.map((e) => `${e.etapa}=${e.n}`).join(" · "));

await c.end();
console.log("");
