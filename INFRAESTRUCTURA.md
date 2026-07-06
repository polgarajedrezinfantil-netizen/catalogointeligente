# Infraestructura — registro de subdominios de myelplay.com

**Fuente de verdad** del namespace `*.myelplay.com` (hallazgo H1 de la auditoría
2026-07-03). Tres productos reparten subdominios de este dominio; un subdominio
se asigna **una sola vez, a un solo producto**, y queda anotado aquí ANTES de
crearlo en Cloudflare/Vercel.

- DNS: Cloudflare (zona `myelplay.com`, id `c63be5e32d38b6d519a49b368187cba8`).
  **No hay wildcard**: cada subdominio es un registro explícito.
- El dominio está dado de alta en el team **POLGAR** de Vercel; el team de
  Nicómaco verifica sus subdominios con TXT cruzado.

## Regla de alta (tienda nueva del catálogo)

1. Consultar la tabla de abajo y la lista de reservados (`lib/saas/subdominios.ts`
   la aplica en código: un slug reservado recibe sufijo automáticamente).
2. Anotar el subdominio aquí (commit).
3. Crear el CNAME en Cloudflare (`<slug>` → `cname.vercel-dns.com`, DNS only)
   y atar el dominio al proyecto `catalogointeligente` (team POLGAR).
   Detalle paso a paso: `docs/ONBOARDING.md`.

## Reservados (nunca asignables a tiendas)

`www` `api` `mail` `smtp` `webmail` `admin` `status` `docs` `cdn` `assets`
`nexus` `agentes` `app` `mcjuarez` `polgar` `platform`

## Registro (verificado en vivo 2026-07-05)

| Subdominio | Producto | Proyecto Vercel · team | Desde |
|---|---|---|---|
| *(apex)* `myelplay.com` | Paraguas corporativo (landing) | `polgar` · POLGAR | may-2026 |
| `www` | Paraguas corporativo | `polgar` · POLGAR | may-2026 |
| `agentes` | **MyelPlay Agentes** (producto/panel) | `catalogointeligente` · POLGAR | jun-2026 |
| `mamielina` | MyelPlay Agentes — tienda 1 | `catalogointeligente` · POLGAR (**migración en curso**, ver Pendientes) | may-2026 |
| `gabrielle` | MyelPlay Agentes — tienda 2 | `catalogointeligente` · POLGAR | 2026-07-05 |
| `app` | Nicómaco (plataforma) | `nicomaco` · nicomaco-s-projects | jun-2026 |
| `mcjuarez` | Nicómaco — tenant | `nicomaco` · nicomaco-s-projects | jun-2026 |
| `polgar` | POLGAR (escuela de ajedrez) | `polgar` · POLGAR | may-2026 |

Clientes nuevos de POLGAR: **no** toman subdominios directos de `myelplay.com`
sin pasar por este registro (su middleware ya solo reconoce tenants de su
allowlist; ver `polgar/frontend/middleware.ts`). Decisión de carril pendiente:
dominio propio de POLGAR o `*.polgar.myelplay.com`.

## Pendientes de infraestructura (2026-07-05)

- **Migrar `mamielina.myelplay.com` al proyecto vivo**: hoy lo sirve el
  proyecto `catalogointeligente` VIEJO del team de Nicómaco
  (`prj_nvXQA22WLMwRIoj6KjtGW5m8GGQ5`, respaldo en `.vercel.foreign-bak/`),
  que auto-despliega del mismo repo. El dominio ya está agregado al proyecto
  del team POLGAR en estado *pending verification*; falta crear en Cloudflare
  el TXT: `_vercel.myelplay.com` = `vc-domain-verify=mamielina.myelplay.com,152ebf69edcf9400a5fe`.
  Después de verificar (Vercel lo re-checa solo), quitar el dominio del
  proyecto viejo y recién entonces puede borrarse ese proyecto huérfano.
- **H3 — dueño de la BD de prod** (`nthbgrjfeorowimktbzy`): **IDENTIFICADO
  (6-jul): la cuenta dueña es `mamielina@myelplay.com`** (confirmado abriendo
  el proyecto "catalogo_inteligente" en su dashboard). La cuenta de la CLI
  (`nexus@myelplay.com`) no la ve hasta ser invitada. Restan: renombrar su
  org a "MyelPlay", invitar a `nexus@` (Developer) + un Owner de respaldo,
  activar MFA y guardar credenciales en el Llavero. OJO visto en el
  dashboard: plan Free ⇒ **"No backups" automáticos** — el respaldo manual
  verificado del 5-jul (`~/Backups/catalogo/`) es hoy el único; repetirlo
  periódicamente hasta subir de plan.
- Huérfanos fuera del team POLGAR (requieren sus propias cuentas):
  `catalogo-mamielina` (team albertos-projects) y `catalogointeligente` viejo
  (team nicomaco — NO borrar hasta migrar el dominio de mamielina).
- **Entorno de pruebas** (etapa 2, único punto restante): crear Supabase
  `myelplay-agentes-dev` (org Myelplay-Nexus vía CLI), aplicar las
  migraciones, crear bucket `fotos`, y poner en Vercel los envs de
  **Preview** (hoy solo existe Production: cualquier preview arranca roto)
  apuntando al proyecto dev. Intentado el 5-jul; requiere visto bueno
  explícito de Albert para aprovisionar la infra.

## Operación (automatizada, GitHub Actions)

- `uptime.yml` — ping cada 15 min a catálogo/login/landing; GitHub avisa por
  correo al fallar. OJO: GitHub pausa crons tras 60 días sin commits.
- `smoke.yml` — en cada deploy de Production: landing, catálogos de ambas
  tiendas (BD), login branded, webhook Meta (403) y cron SaaS (401).
- `rag-reindex.yml` — reindexado diario del RAG por tienda (variable de repo
  `RAG_TIENDAS`). Mientras `VOYAGE_API_KEY` no esté en Vercel sale en verde
  con aviso de "saltado". Secret del repo: `CRON_SECRET` (= el de Vercel).
- `npm run test:aislamiento` — suite H10 (84 checks) de que una tienda jamás
  lee/escribe datos de otra; todo en ROLLBACK, seguro contra prod.

## Credenciales (inventario — los valores NO van aquí)

| Dónde | Entrada | Qué es |
|---|---|---|
| Llavero macOS | `supabase-catalogo-db` | password BD prod (`nthbgrjfeorowimktbzy`) |
| Llavero macOS | `mp-saas-catalogo` | token MP Suscripciones del SaaS |
| Llavero macOS | `resend-myelplay` | API key Resend (sending-only) |
| GitHub repo secret | `CRON_SECRET` | mismo valor que en Vercel |
| Vercel (Production) | todas las de `.env.example` | SENSITIVE: write-only, `env pull` devuelve vacío |
| CLIs en esta Mac | Vercel + GitHub (`polgarajedrezinfantil-netizen`), Supabase (`nexus@myelplay.com`), wrangler (`polgarajedrezinfantil@gmail.com`, solo lectura de zona) | |

Falta (decisión/cuenta de Albert): `VOYAGE_API_KEY` (Voyage AI) para encender
la búsqueda vectorial del agente — hoy cae a búsqueda por palabra clave.

## Aclarado en la limpieza del 2026-07-05

- Borrados del team POLGAR los proyectos Vercel huérfanos `agenteiaventas`
  (servía 404) y `nexus` (0 deployments; NO era el proyecto vinculado de
  Nexus — ese es `myelplay-nexus` en otro team, `team_8wPx5NGm…`).
- La Supabase `hrzfmyzlgkypzurfdkvz` (org `Myelplay-Nexus`, cuenta
  `nexus@myelplay.com`) **NO es huérfana**: es la BD de **MyelPlay Nexus**,
  el portal de seguimiento de proyectos para clientes
  (repo local `~/Projects/Seguimiento`, package `myelplay-nexus`), con datos
  reales (6 clientes, 10 proyectos, 7 pagos). No borrar.
- Ojo: el repo local `Seguimiento` empuja al GitHub `agenteiaventas.git`
  (repo reutilizado). Conviene renombrar ese repo en GitHub a
  `myelplay-nexus` para que el nombre diga la verdad.
- Identidad git unificada en los 4 repos (config global; se quitaron los
  overrides locales "Mamielina" y "polgarajedrezinfantil-netizen"):
  `Alberto <polgarajedrezinfantil-netizen@users.noreply.github.com>`.
  OJO: el correo debe ser el noreply de la cuenta GitHub dueña del team —
  `algopiensa@gmail.com` pertenece al OTRO GitHub de Albert (`Argos0621`) y
  Vercel **bloquea el deploy** (`TEAM_ACCESS_REQUIRED`) si el autor del
  commit no es miembro del team.
