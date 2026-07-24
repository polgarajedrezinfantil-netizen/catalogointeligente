// Siembra la BD DEV con datos suficientes para revisar el CRM:
// clientes paginables, pedidos en todos los estados, solicitudes y actividad.
// Crea además un admin de la tienda demo (el superadmin no ve esa sección).
//
//   node scripts/seed-crm-dev.mjs
//
// Solo funciona contra dev. Nunca toca producción.
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import pg from "pg";

const REF = "whyqdxwpqdmcpdvrfkke"; // myelplay-agentes-dev
const pass = execSync("security find-generic-password -s supabase-catalogo-dev-db -w").toString().trim();

const c = new pg.Client({
  host: `db.${REF}.supabase.co`, port: 5432, user: "postgres",
  password: pass, database: "postgres", ssl: { rejectUnauthorized: false },
});
await c.connect();

const { rows: [tienda] } = await c.query("select id, nombre from public.tiendas order by creado limit 1");
if (!tienda) throw new Error("No hay tienda en dev");
const T = tienda.id;
console.log(`Sembrando sobre «${tienda.nombre}» (${REF})\n`);

// Limpia lo sembrado antes por este script (idempotente).
await c.query(`delete from public.eventos_cliente where tienda_id = $1`, [T]);
await c.query(`delete from public.eventos_apartado where tienda_id = $1 and celular like '656%'`, [T]);
await c.query(`delete from public.solicitudes_cliente where tienda_id = $1`, [T]);
await c.query(`delete from public.mensajes where tienda_id = $1`, [T]);
await c.query(`update public.productos set pedido_id = null where tienda_id = $1`, [T]);
await c.query(`delete from public.pedidos where tienda_id = $1`, [T]);
await c.query(`delete from public.clientes where tienda_id = $1`, [T]);
await c.query(`delete from public.productos where tienda_id = $1 and nombre like 'Demo %'`, [T]);

const { rows: lineas } = await c.query("select id, nombre from public.lineas_de_venta where tienda_id = $1", [T]);

// --- Catálogo -----------------------------------------------------------
await c.query(
  `insert into public.productos (tienda_id, linea_id, nombre, precio, estado)
   select $1, (array[$2::uuid,$3::uuid,$4::uuid])[1 + (i % 3)],
          'Demo prenda ' || i, 150 + (i * 17) % 600, 'disponible'
     from generate_series(1, 30) i`,
  [T, lineas[0].id, lineas[1].id, lineas[2]?.id ?? lineas[0].id],
);

// --- Clientes -----------------------------------------------------------
const NOMBRES = ["Ana","Grecia","Itzel","Karla","Lupita","Mariana","Paola","Rocío","Sofía","Valeria",
  "Brenda","Carmen","Daniela","Elena","Fernanda","Gaby","Hilda","Irene","Jimena","Lorena",
  "Mónica","Nadia","Olivia","Patricia","Queta","Rebeca","Susana","Tania","Úrsula","Verónica",
  "Wendy","Ximena","Yolanda","Zoe","Adriana","Beatriz","Cecilia","Diana","Estela","Flor",
  "Gloria","Helena","Inés","Julia","Laura"];

await c.query(
  `insert into public.clientes (tienda_id, celular, nombre, correo, ultima_visita)
   select $1,
          '656' || lpad((1000000 + i)::text, 7, '0'),
          ($2::text[])[i],
          lower(($2::text[])[i]) || i || '@ejemplo.mx',
          now() - make_interval(days => (i * 7) % 190)
     from generate_series(1, $3::int) i`,
  [T, NOMBRES, NOMBRES.length],
);

// --- Actividad: cada quien mira y aparta algunas prendas -----------------
await c.query(
  `insert into public.eventos_cliente (tienda_id, celular, tipo, ref_id, hora)
   select $1, c.celular, 'abrir_producto', p.id::text, now() - make_interval(hours => (random()*400)::int)
     from public.clientes c
     join lateral (select id from public.productos where tienda_id = $1
                    order by md5(id::text || c.celular) limit 4) p on true
    where c.tienda_id = $1`,
  [T],
);
await c.query(
  `insert into public.eventos_apartado (tienda_id, celular, tipo, producto_id, hora)
   select $1, c.celular, 'apartar', p.id, now() - make_interval(hours => (random()*300)::int)
     from public.clientes c
     join lateral (select id from public.productos where tienda_id = $1
                    order by md5(id::text || c.celular || 'x') limit 2) p on true
    where c.tienda_id = $1`,
  [T],
);

// --- Pedidos en todos los estados ---------------------------------------
await c.query(
  `insert into public.pedidos (tienda_id, folio, cliente_celular, cliente_nombre, cliente_correo,
                               items, subtotal, total, estado, creado, confirmado_en, motivo)
   select $1, i, c.celular, c.nombre, c.correo,
          jsonb_build_array(
            jsonb_build_object('producto_id', gen_random_uuid(), 'nombre', 'Demo prenda ' || i, 'precio', 200 + i * 10),
            jsonb_build_object('producto_id', gen_random_uuid(), 'nombre', 'Demo prenda ' || (i+1), 'precio', 150 + i * 5)),
          350 + i * 15, 350 + i * 15,
          (array['pagado','pendiente','pagado','cancelado','pagado','devuelto'])[1 + (i % 6)],
          now() - make_interval(days => i, hours => i * 3),
          case when (array['pagado','pendiente','pagado','cancelado','pagado','devuelto'])[1 + (i % 6)] = 'pagado'
               then now() - make_interval(days => i) end,
          case when (array['pagado','pendiente','pagado','cancelado','pagado','devuelto'])[1 + (i % 6)] = 'cancelado'
               then 'Ya no lo quiso'
               when (array['pagado','pendiente','pagado','cancelado','pagado','devuelto'])[1 + (i % 6)] = 'devuelto'
               then 'No le quedó la talla' end
     from generate_series(1, 24) i
     join lateral (select celular, nombre, correo from public.clientes
                    where tienda_id = $1 order by celular limit 1 offset (i - 1)) c on true`,
  [T],
);

// --- Solicitudes abiertas y un mensaje enviado --------------------------
await c.query(
  `insert into public.solicitudes_cliente (tienda_id, celular, texto, estado, creado)
   select $1, c.celular, t.txt, 'abierta', now() - make_interval(days => t.d)
     from (values ('Pañalera', 1), ('Botines del 23', 3), ('Algo para bautizo', 5)) as t(txt, d)
     join lateral (select celular from public.clientes where tienda_id = $1
                    order by celular limit 1 offset t.d) c on true`,
  [T],
);

const { rows: [perfilSuper] } = await c.query("select id from public.perfiles where rol = 'superadmin' limit 1");
await c.query(
  `insert into public.mensajes (tienda_id, celular, canal, cuerpo, enviado_por)
   select $1, celular, 'whatsapp', '¡Hola! Ya llegó lo que buscabas 🍯', $2
     from public.clientes where tienda_id = $1 order by celular limit 3`,
  [T, perfilSuper.id],
);

// --- Admin de la tienda (el superadmin no ve la sección de tienda) -------
const CORREO = "demo-tienda@myelplay.com";
const CLAVE = randomBytes(9).toString("base64url");
const { rows: [ya] } = await c.query("select id from auth.users where email = $1", [CORREO]);
let uid = ya?.id;

if (!uid) {
  const claves = JSON.parse(
    execSync(`supabase projects api-keys --project-ref ${REF} -o json`).toString(),
  );
  const service = claves.find((k) => k.name === "service_role").api_key;
  const r = await fetch(`https://${REF}.supabase.co/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: CORREO, password: CLAVE, email_confirm: true }),
  });
  const j = await r.json();
  if (!j.id) throw new Error("No se pudo crear el usuario: " + JSON.stringify(j).slice(0, 200));
  uid = j.id;
  console.log(`Usuario nuevo · ${CORREO} · contraseña: ${CLAVE}`);
} else {
  console.log(`Usuario ${CORREO} ya existía (contraseña sin cambios)`);
}

await c.query(
  `insert into public.perfiles (id, nombre, rol, tienda_id) values ($1, 'Demo Tienda', 'admin', $2)
   on conflict (id) do update set rol = 'admin', tienda_id = excluded.tienda_id`,
  [uid, T],
);

const { rows: [n] } = await c.query(
  `select (select count(*) from public.clientes where tienda_id=$1) clientes,
          (select count(*) from public.pedidos  where tienda_id=$1) pedidos,
          (select count(*) from public.eventos_cliente where tienda_id=$1) eventos`, [T]);
console.log(`\nListo: ${n.clientes} clientes · ${n.pedidos} pedidos · ${n.eventos} eventos`);
await c.end();
