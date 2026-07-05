// Suite de aislamiento multitenant (H10 de la auditoría 2026-07-03).
//
// Verifica contra la BD que un usuario de la tienda A jamás lee ni escribe
// datos de la tienda B (y que un usuario sin perfil no ve nada privado),
// emulando el JWT como lo evalúa PostgREST: request.jwt.claims + SET ROLE
// authenticated. TODO corre dentro de transacciones con ROLLBACK — la suite
// no deja rastro, es seguro correrla contra producción.
//
// Uso:  npm run test:aislamiento
// Conexión: SUPABASE_DB_URL en el entorno, o (en la Mac de Albert) la
// contraseña del Llavero `supabase-catalogo-db` contra la BD de prod.
// Requiere >= 2 tiendas en la BD. Las direcciones sin usuario admin se
// saltan con aviso (dar de alta al admin de la tienda las activa).
import { execSync } from "node:child_process";
import pg from "pg";

function conexion() {
  if (process.env.SUPABASE_DB_URL) {
    return { connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } };
  }
  const password = execSync("security find-generic-password -s supabase-catalogo-db -w")
    .toString()
    .trim();
  return {
    host: "db.nthbgrjfeorowimktbzy.supabase.co",
    port: 5432,
    user: "postgres",
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  };
}

// Tablas que ningún usuario ajeno a la tienda debe poder LEER. (Las públicas
// del catálogo —productos, nidos, lineas_de_venta, tiendas, etc.— se leen
// cross-tenant por diseño; ahí solo se exige que no se pueda escribir.)
const PRIVADAS_ESPERADAS = [
  "pedidos",
  "clientes",
  "perfiles",
  "agente_config",
  "agente_secretos",
  "agente_canales",
  "agente_conversaciones",
  "agente_mensajes",
  "agente_ventas",
  "notificaciones",
  "solicitudes_cliente",
  "eventos_cliente",
  "lista_espera",
  "mensajes",
  "producto_embeddings",
  "cupones",
  "eventos_apartado",
];

const c = new pg.Client(conexion());
await c.connect();

let pasa = 0;
let falla = 0;
const ok = (nombre, cond, extra = "") => {
  if (cond) {
    pasa++;
    console.log(`  ✓ ${nombre}`);
  } else {
    falla++;
    console.log(`  ✗ ${nombre} ${extra}`);
  }
};

const { rows: tiendas } = await c.query("select id, slug from tiendas order by creado limit 2");
if (tiendas.length < 2) {
  console.error("Se necesitan al menos 2 tiendas para probar aislamiento.");
  process.exit(2);
}
const [A, B] = tiendas;
const { rows: admins } = await c.query(
  "select id, tienda_id from perfiles where rol = 'admin' and tienda_id is not null",
);
const adminDe = (t) => admins.find((a) => a.tienda_id === t.id)?.id ?? null;

const TABLAS = (
  await c.query(
    "select table_name from information_schema.columns where table_schema = 'public' and column_name = 'tienda_id' group by table_name order by table_name",
  )
).rows.map((r) => r.table_name);
const PRIVADAS = PRIVADAS_ESPERADAS.filter((t) => TABLAS.includes(t));

async function comoUsuario(uid, fn) {
  await c.query("begin");
  await c.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: uid, role: "authenticated" }),
  ]);
  await c.query("set local role authenticated");
  try {
    await fn();
  } finally {
    await c.query("rollback");
  }
}

async function probarDireccion(nombre, uid, propia, ajena) {
  console.log(`\n— ${nombre} —`);
  await comoUsuario(uid, async () => {
    if (propia) {
      const { rows } = await c.query(
        "select count(*)::int n from productos where tienda_id = $1",
        [propia.id],
      );
      ok(`ve sus propios productos (${rows[0].n})`, rows[0].n > 0);
    }
    for (const t of PRIVADAS) {
      const { rows } = await c.query(`select count(*)::int n from ${t} where tienda_id = $1`, [
        ajena.id,
      ]);
      ok(`lee 0 de ${t} ajena`, rows[0].n === 0, `(vio ${rows[0].n})`);
    }
    for (const t of TABLAS) {
      await c.query("savepoint s");
      let afectadas = 0;
      let err = null;
      try {
        afectadas = (
          await c.query(`update ${t} set tienda_id = tienda_id where tienda_id = $1`, [ajena.id])
        ).rowCount;
      } catch (e) {
        err = e.message;
      }
      await c.query("rollback to s");
      ok(`no escribe en ${t} ajena`, err !== null || afectadas === 0, `(afectó ${afectadas})`);
    }
    await c.query("savepoint s");
    let rT = 0;
    let eT = null;
    try {
      rT = (await c.query("update tiendas set nombre = nombre where id = $1", [ajena.id]))
        .rowCount;
    } catch (e) {
      eT = e.message;
    }
    await c.query("rollback to s");
    ok("no edita la tienda ajena", eT !== null || rT === 0, `(afectó ${rT})`);
    if (propia) {
      // Candado de cobro: ni el admin de la tienda puede tocar `activa`.
      await c.query("savepoint s");
      let rC = 0;
      let eC = null;
      try {
        rC = (await c.query("update tiendas set activa = not activa where id = $1", [propia.id]))
          .rowCount;
      } catch (e) {
        eC = e.message;
      }
      await c.query("rollback to s");
      ok("candado de cobro (activa) bloquea", eC !== null || rC === 0, `(afectó ${rC})`);
    }
    await c.query("savepoint s");
    let rS = 0;
    let eS = null;
    try {
      rS = (
        await c.query("insert into storage.objects (bucket_id, name) values ('fotos', $1)", [
          `${ajena.id}/prueba-aislamiento.jpg`,
        ])
      ).rowCount;
    } catch (e) {
      eS = e.message;
    }
    await c.query("rollback to s");
    ok("no sube fotos a carpeta ajena", eS !== null || rS === 0, `(insertó ${rS})`);
  });
}

console.log(
  `Tiendas: A=${A.slug} B=${B.slug} · tablas con tienda_id: ${TABLAS.length} · privadas: ${PRIVADAS.length}`,
);
const uidA = adminDe(A);
if (uidA) await probarDireccion(`admin de ${A.slug} → ${B.slug}`, uidA, A, B);
else console.log(`\n(sin admin en ${A.slug} — dirección saltada)`);
const uidB = adminDe(B);
if (uidB) await probarDireccion(`admin de ${B.slug} → ${A.slug}`, uidB, B, A);
else console.log(`\n(sin admin en ${B.slug} — dirección saltada)`);
await probarDireccion(
  "usuario sin perfil → ambas",
  "00000000-0000-4000-8000-000000000000",
  null,
  A,
);

console.log(`\nRESULTADO: ${pasa} pasan, ${falla} fallan`);
await c.end();
process.exit(falla ? 1 : 0);
