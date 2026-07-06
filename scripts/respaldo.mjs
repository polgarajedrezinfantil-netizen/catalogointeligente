// Respaldo de la BD de producción + fotos del bucket (plan Free de Supabase
// = SIN backups automáticos; este script es el respaldo del negocio).
//
//   npm run respaldo        (o lo dispara solo el LaunchAgent semanal
//                            com.myelplay.respaldo-catalogo — ver abajo)
//
// Qué hace:
//   1. pg_dump (formato custom) de public+auth+storage →
//      ~/Backups/catalogo/respaldo-YYYY-MM-DD.dump
//   2. Verifica el dump con pg_restore --list (un dump ilegible no es respaldo).
//   3. Espejo aditivo del bucket `fotos` → ~/Backups/catalogo/fotos/
//      (solo baja lo que falta; nunca borra local).
//   4. Retención: conserva los últimos 8 dumps.
//   5. Si algo falla: notificación de macOS + exit 1. Log en respaldo.log.
//
// Credenciales: password de BD del Llavero `supabase-catalogo-db`;
// SUPABASE_SERVICE_ROLE_KEY del .env.local del repo. Nada de secretos aquí.
// OJO: el dump contiene hashes de auth — NO subirlo a ningún lado.
//
// LaunchAgent (lunes 09:30, corre al despertar si la Mac dormía):
//   ~/Library/LaunchAgents/com.myelplay.respaldo-catalogo.plist
import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PG_BIN = "/opt/homebrew/opt/postgresql@17/bin";
const HOST = "db.nthbgrjfeorowimktbzy.supabase.co";
const URL_STORAGE = "https://nthbgrjfeorowimktbzy.supabase.co/storage/v1";
const BUCKET = "fotos";
const DIR = join(homedir(), "Backups", "catalogo");
const LOG = join(DIR, "respaldo.log");
const RETENER = 8;
const REPO = dirname(dirname(fileURLToPath(import.meta.url)));

const hoy = new Date().toISOString().slice(0, 10);
const log = (m) => {
  const linea = `[${new Date().toISOString()}] ${m}`;
  console.log(linea);
  appendFileSync(LOG, linea + "\n");
};

function avisar(msg) {
  try {
    execFileSync("/usr/bin/osascript", ["-e",
      `display notification ${JSON.stringify(msg)} with title "Respaldo catálogo FALLÓ"`]);
  } catch { /* sin sesión gráfica */ }
}

try {
  mkdirSync(DIR, { recursive: true });

  // --- 1. pg_dump ------------------------------------------------------
  const pw = execSync("/usr/bin/security find-generic-password -s supabase-catalogo-db -w")
    .toString().trim();
  const dump = join(DIR, `respaldo-${hoy}.dump`);
  log(`pg_dump → ${dump}`);
  execFileSync(join(PG_BIN, "pg_dump"), [
    "-Fc", "--schema=public", "--schema=auth", "--schema=storage",
    "-f", dump,
    `postgresql://postgres@${HOST}:5432/postgres`,
  ], { env: { ...process.env, PGPASSWORD: pw }, stdio: ["ignore", "inherit", "inherit"] });

  // --- 2. Verificación del dump ----------------------------------------
  const bytes = statSync(dump).size;
  if (bytes < 50_000) throw new Error(`dump sospechosamente chico: ${bytes} bytes`);
  const listado = execFileSync(join(PG_BIN, "pg_restore"), ["--list", dump]).toString();
  const tablas = (listado.match(/TABLE DATA/g) || []).length;
  if (tablas < 10) throw new Error(`el dump solo lista ${tablas} tablas con datos`);
  log(`dump OK: ${(bytes / 1024).toFixed(0)} KB, ${tablas} tablas con datos`);

  // --- 3. Espejo aditivo de fotos --------------------------------------
  const env = readFileSync(join(REPO, ".env.local"), "utf8");
  const svc = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim();
  if (!svc) throw new Error("SUPABASE_SERVICE_ROLE_KEY no está en .env.local");
  const cab = { apikey: svc, Authorization: `Bearer ${svc}`, "Content-Type": "application/json" };

  async function listar(prefix) {
    const res = await fetch(`${URL_STORAGE}/object/list/${BUCKET}`, {
      method: "POST", headers: cab,
      body: JSON.stringify({ prefix, limit: 10000, offset: 0 }),
    });
    if (!res.ok) throw new Error(`list ${prefix || "/"}: HTTP ${res.status}`);
    return res.json();
  }

  let nuevas = 0, existentes = 0;
  async function bajar(prefix) {
    for (const item of await listar(prefix)) {
      const ruta = prefix ? `${prefix}/${item.name}` : item.name;
      if (!item.id) { await bajar(ruta); continue; } // carpeta
      const destino = join(DIR, "fotos", ruta);
      if (existsSync(destino)) { existentes++; continue; }
      const res = await fetch(`${URL_STORAGE}/object/${BUCKET}/${ruta}`, { headers: cab });
      if (!res.ok) throw new Error(`bajar ${ruta}: HTTP ${res.status}`);
      mkdirSync(dirname(destino), { recursive: true });
      writeFileSync(destino, Buffer.from(await res.arrayBuffer()));
      nuevas++;
    }
  }
  await bajar("");
  log(`fotos OK: ${nuevas} nuevas, ${existentes} ya respaldadas`);

  // --- 4. Retención ------------------------------------------------------
  const dumps = readdirSync(DIR).filter((f) => /^respaldo-\d{4}-\d{2}-\d{2}\.dump$/.test(f)).sort();
  for (const viejo of dumps.slice(0, Math.max(0, dumps.length - RETENER))) {
    rmSync(join(DIR, viejo));
    log(`retención: borrado ${viejo}`);
  }

  log("RESPALDO COMPLETO ✓");
} catch (e) {
  log(`ERROR: ${e.message}`);
  avisar(e.message.slice(0, 120));
  process.exit(1);
}
