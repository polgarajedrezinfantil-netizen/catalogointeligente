// Aplica la migración 0031 (columna meta_pixel_id en tiendas).
// Idempotente (add column if not exists). Uso: node scripts/aplicar-0031.mjs
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import pg from "pg";

const pass = execSync("security find-generic-password -s supabase-catalogo-db -w").toString().trim();
const c = new pg.Client({
  host: "db.nthbgrjfeorowimktbzy.supabase.co", port: 5432, user: "postgres",
  password: pass, database: "postgres", ssl: { rejectUnauthorized: false },
});
await c.connect();

const sql = readFileSync("supabase/migrations/0031_meta_pixel.sql", "utf8");
await c.query(sql);

const col = await c.query(
  "select 1 from information_schema.columns where table_name='tiendas' and column_name='meta_pixel_id'",
);
console.log("0031 (columna meta_pixel_id):", col.rowCount ? "APLICADA ✓" : "FALTA ✗");

await c.end();
