// Prueba de humo del CRM contra una BD real, con el JWT emulado como lo
// evalúa PostgREST (request.jwt.claims + SET ROLE authenticated), que es la
// única forma de ejercitar las RPCs tal y como las llama el panel.
//
// Todo corre dentro de transacciones con ROLLBACK: no deja rastro, es seguro
// contra producción.
//
//   node scripts/humo-crm.mjs prod
//   node scripts/humo-crm.mjs dev
import { execSync } from "node:child_process";
import pg from "pg";

const ENTORNOS = {
  dev:  { host: "db.whyqdxwpqdmcpdvrfkke.supabase.co", llave: "supabase-catalogo-dev-db", nombre: "DEV" },
  prod: { host: "db.nthbgrjfeorowimktbzy.supabase.co", llave: "supabase-catalogo-db",     nombre: "PRODUCCIÓN" },
};
const cfg = ENTORNOS[process.argv[2]];
if (!cfg) { console.error("Uso: node scripts/humo-crm.mjs <dev|prod>"); process.exit(1); }

const pass = execSync(`security find-generic-password -s ${cfg.llave} -w`).toString().trim();
const c = new pg.Client({
  host: cfg.host, port: 5432, user: "postgres", password: pass,
  database: "postgres", ssl: { rejectUnauthorized: false },
});
await c.connect();

let ok = 0, mal = 0;
const check = (nombre, cond, extra = "") => {
  console.log(`  ${cond ? "✓" : "✗"} ${nombre}${extra ? "  " + extra : ""}`);
  cond ? ok++ : mal++;
};

async function comoUsuario(uid, fn) {
  await c.query("begin");
  await c.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: uid, role: "authenticated" }),
  ]);
  await c.query("set local role authenticated");
  try { await fn(); } finally { await c.query("rollback"); }
}

// Un admin por tienda (las tiendas sin admin se saltan).
const { rows: admins } = await c.query(
  `select p.id, p.tienda_id, t.slug, t.nombre
     from public.perfiles p join public.tiendas t on t.id = p.tienda_id
    where p.rol in ('admin','delegado') order by t.creado`,
);
if (admins.length === 0) { console.log("No hay admins de tienda; nada que probar."); await c.end(); process.exit(0); }

console.log(`\n=== Humo del CRM · ${cfg.nombre} ===`);

for (const a of admins) {
  console.log(`\n— ${a.nombre} (${a.slug}) —`);
  await comoUsuario(a.id, async () => {
    const { rows: [{ clientes_pagina: p }] } =
      await c.query("select public.clientes_pagina($1)", [a.tienda_id]);
    check("clientes_pagina responde", p && typeof p.total === "number", `total=${p?.total}`);
    check("trae el hoy de la tienda", typeof p?.hoy === "string", p?.hoy);
    check("trae los conteos por segmento", p?.conteos && "seguir_hoy" in p.conteos,
          JSON.stringify(p?.conteos));
    check("la página no excede el tamaño pedido", (p?.filas?.length ?? 0) <= p?.por);

    // Segmentos: ninguno debe reventar y ninguno superar el total.
    for (const f of ["seguir_hoy","en_pedido","interesado","comprador","recurrente","nuevo","dormidos","solicitudes"]) {
      const { rows: [{ clientes_pagina: s }] } =
        await c.query("select public.clientes_pagina($1, null, $2)", [a.tienda_id, f]);
      check(`segmento ${f}`, s.total <= p.total, `${s.total}`);
    }

    // Búsqueda: un nombre con dígito no debe arrastrar medio padrón.
    const { rows: [{ clientes_pagina: b }] } =
      await c.query("select public.clientes_pagina($1, $2)", [a.tienda_id, "Cliente 5"]);
    check("la búsqueda con texto no casa por dígito suelto", b.total <= p.total, `${b.total}/${p.total}`);

    if (p.filas.length > 0) {
      const cel = p.filas[0].celular;
      const { rows: [{ cliente_ficha: f }] } =
        await c.query("select public.cliente_ficha($1, $2)", [a.tienda_id, cel]);
      check("cliente_ficha responde", !!f?.cliente);
      check("la ficha trae línea de tiempo", Array.isArray(f?.linea_tiempo), `${f?.linea_tiempo?.length} hitos`);
      check("la ficha trae etapa", typeof f?.cliente?.etapa === "string", f?.cliente?.etapa);

      // Escrituras (se deshacen con el rollback).
      await c.query("select public.guardar_cliente_crm($1,$2,$3,$4,$5)",
        [a.tienda_id, cel, "nota de humo", ["humo"], false]);
      await c.query("select public.guardar_seguimiento_cliente($1,$2,null,$3,$4)",
        [a.tienda_id, cel, "seguimiento de humo", 0]);
      const { rows: [{ cliente_ficha: f2 }] } =
        await c.query("select public.cliente_ficha($1, $2)", [a.tienda_id, cel]);
      check("guarda nota y etiquetas", f2.cliente.nota === "nota de humo" && f2.cliente.etiquetas[0] === "humo");
      check("agenda el seguimiento en el día de la tienda", f2.cliente.proximo_seguimiento === f2.hoy,
            `${f2.cliente.proximo_seguimiento} vs ${f2.hoy}`);

      const { rows: [{ clientes_pagina: h }] } =
        await c.query("select public.clientes_pagina($1, null, 'seguir_hoy')", [a.tienda_id]);
      check("y aparece en «a seguir hoy»", h.total >= 1, `${h.total}`);
    } else {
      console.log("  (sin clientes: se salta la ficha)");
    }

    // Aislamiento: pedir otra tienda debe dar «No autorizado».
    const otra = admins.find((x) => x.tienda_id !== a.tienda_id);
    if (otra) {
      let bloqueado = false;
      await c.query("savepoint s");
      try { await c.query("select public.clientes_pagina($1)", [otra.tienda_id]); }
      catch { bloqueado = true; }
      await c.query("rollback to s");
      check(`no puede leer la tienda ${otra.slug}`, bloqueado);
    }
  });
}

console.log(`\nRESULTADO: ${ok} pasan, ${mal} fallan\n`);
await c.end();
process.exit(mal ? 1 : 0);
