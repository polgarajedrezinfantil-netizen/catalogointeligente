# 🟡 Revisión Cero — MAMIELINA

Documento de arranque. **Al inicio de cada sesión** se corre esta revisión para
confirmar que todas las cuentas y accesos siguen conectados antes de programar.

---

## 1) Estado de cuentas y accesos

| Servicio | Para qué | Estado | Acción |
|---|---|---|---|
| **GitHub** (`gh`) | repo / deploy | ✅ con sesión (`polgarajedrezinfantil-netizen`) | — |
| **Vercel** | hosting / producción | ✅ con sesión (`admin-99277421`) | linkear proyecto en Fase 0 |
| **Node / npm / pnpm / git** | toolchain | ✅ instalados | — |
| **Supabase (proyecto)** | DB / Storage / Auth / Realtime | ✅ conectado y verificado (ref `nthbgrjfeorowimktbzy`) | — |
| **Supabase CLI** | migraciones | ❌ no instalado | `brew install supabase/tap/supabase` (Fase 0) |
| **Anthropic** | IA visión + PDF | ✅ key pegada | — |
| **SerpAPI / Rainforest** | precios reales (Amazon) | ✅ key pegada | — |
| **Mercado Pago** | cobros / webhook | ⏳ falta (se usa en Fase 8) | crear app + credenciales de prueba |
| **Belvo (banco)** | open banking / finanzas | ⏳ falta (se usa en Fase 8) | crear cuenta sandbox + keys |
| **Secretos internos** | cifrado / cron | ✅ generados | — |
| **Resend (correo)** | mensajes por email | ⬜ opcional / después | — |
| **WhatsApp Business API** | envío automático | ⬜ opcional (default: links wa.me) | — |

> Todas las llaves se pegan en **`.env.local`** (no se sube a git).

---

## 2) Cómo obtener lo que falta

**Supabase (proyecto nuevo):** app.supabase.com → *New project* → al terminar,
Project Settings → **API** → copia *Project URL*, *anon public* y *service_role*
a `.env.local`. En Storage crea un bucket público `fotos`.

**Anthropic:** console.anthropic.com → *API Keys* → *Create Key* → pega en `ANTHROPIC_API_KEY`.

**SerpAPI:** serpapi.com → registrarte → *Dashboard* → *Your Private API Key* → `SERPAPI_KEY`.
(Alternativa: rainforestapi.com → `RAINFOREST_API_KEY`.)

**Mercado Pago:** mercadopago.com.mx/developers → *Tus integraciones* → *Crear aplicación* →
*Credenciales de prueba* → copia *Access Token* y *Public Key*. El `MP_WEBHOOK_SECRET`
lo defines tú (cadena aleatoria) y se valida en el webhook.

**Belvo:** dashboard.belvo.com → registrarte → *Settings → API keys* → modo **sandbox** →
copia *Secret ID* y *Secret Password* a `BELVO_SECRET_ID` / `BELVO_SECRET_PASSWORD`.

**Secretos internos:** en una terminal:
`openssl rand -hex 32` → `FIELD_ENCRYPTION_KEY`  ·  `openssl rand -hex 16` → `CRON_SECRET`.

---

## 3) Checklist de Revisión Cero (correr al iniciar sesión)

- [ ] `gh auth status` → con sesión
- [ ] `vercel whoami` → con sesión
- [ ] `command -v supabase` → instalado
- [ ] `.env.local` tiene las llaves obligatorias llenas (Supabase ×3, Anthropic)
- [ ] Ping a Supabase OK (script `npm run check:env` — se crea en Fase 0)
- [ ] (cuando aplique) MP en sandbox responde · Belvo sandbox responde

**Obligatorias para arrancar a programar:** Supabase ×3 + Anthropic.
**Necesarias por fase:** SerpAPI (Fase 6) · Mercado Pago (Fase 8) · Belvo (Fase 8).

---

## 4) Próxima sesión
1. Pega en `.env.local` las llaves que ya tengas (mínimo Supabase + Anthropic).
2. Avísame "corre la revisión cero" → verifico conexiones y reporto el semáforo.
3. Si está verde lo obligatorio, arranco la **Fase 0** del plan.
