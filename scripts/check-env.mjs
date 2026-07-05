// Revisión cero — verifica que las llaves estén presentes y que Supabase
// responda. No imprime valores secretos. Uso: npm run check:env
import { readFileSync } from "node:fs";

// Carga .env.local de forma simple (sin dependencias).
function cargarEnv() {
  try {
    const txt = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const linea of txt.split("\n")) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    console.error("⚠️  No se encontró .env.local");
  }
}
cargarEnv();

const OBLIGATORIAS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ANTHROPIC_API_KEY",
];
const OPCIONALES = [
  "VOYAGE_API_KEY",        // RAG del agente (embeddings)
  "META_APP_SECRET",       // webhooks de Meta/WhatsApp
  "META_PAGE_TOKEN",       // envío por Messenger/Instagram
  "WHATSAPP_TOKEN",        // envío por WhatsApp
  "MP_CLIENT_ID",          // Marketplace OAuth (cobros)
  "MP_CLIENT_SECRET",
  "MP_WEBHOOK_SECRET",
  "MP_SAAS_ACCESS_TOKEN",  // Suscripciones del SaaS (mensualidad)
  "FIELD_ENCRYPTION_KEY",  // cifra secretos por tienda
  "SERPAPI_KEY",           // precios de referencia (panel)
  "RESEND_API_KEY",        // correos a clientes
];

let faltan = false;
console.log("== Llaves obligatorias ==");
for (const k of OBLIGATORIAS) {
  const ok = !!process.env[k];
  console.log(`  ${ok ? "✅" : "❌"} ${k}`);
  if (!ok) faltan = true;
}
console.log("== Opcionales (por fase) ==");
for (const k of OPCIONALES) {
  console.log(`  ${process.env[k] ? "✅" : "⬜"} ${k}`);
}

// Ping a Supabase (solo status).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (url?.startsWith("https://") && anon) {
  try {
    const r = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anon },
    });
    console.log(`== Supabase Auth health: ${r.status} ${r.ok ? "✅" : "❌"}`);
  } catch (e) {
    console.log("== Supabase: error de red", e.message);
    faltan = true;
  }
} else {
  console.log("== Supabase URL inválida (debe empezar con https://) ❌");
  faltan = true;
}

process.exit(faltan ? 1 : 0);
