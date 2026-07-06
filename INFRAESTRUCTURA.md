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
| `mamielina` | MyelPlay Agentes — tienda 1 | `catalogointeligente` · POLGAR (migrado del proyecto viejo el 6-jul) | may-2026 |
| `gabrielle` | MyelPlay Agentes — tienda 2 | `catalogointeligente` · POLGAR | 2026-07-05 |
| `app` | Nicómaco (plataforma) | `nicomaco` · nicomaco-s-projects | jun-2026 |
| `mcjuarez` | Nicómaco — tenant | `nicomaco` · nicomaco-s-projects | jun-2026 |
| `polgar` | POLGAR (escuela de ajedrez) | `polgar` · POLGAR | may-2026 |
| `nexus` | MyelPlay Nexus (portal seguimiento de proyectos) | `myelplay-nexus` · albertos-projects (login: cuenta algopiensa, usuario `algopiensa-7360`) | jun-2026 |

**Carril de POLGAR (decidido 2026-07-06):** sus clientes futuros viven en
`<cliente>.polgar.myelplay.com` (namespace propio, implementado en
`polgar/frontend/middleware.ts`). Alta de un cliente de POLGAR: CNAME
`<cliente>.polgar` → `cname.vercel-dns.com` en Cloudflare + dominio en el
proyecto Vercel `polgar` + fila aquí. Subdominios directos de
`myelplay.com` quedan reservados para tiendas del catálogo e infra.

## Pendientes de infraestructura (2026-07-05)

- ~~Migrar `mamielina.myelplay.com` al proyecto vivo~~ **HECHO (6-jul)**:
  TXT nuevo + borrado del TXT viejo → verify OK; el dominio quedó en
  `catalogointeligente` (team POLGAR) junto a agentes y gabrielle, smoke
  verde. El `catalogointeligente` viejo del team de Nicómaco ya no sirve
  nada → **borrable** (igual que `catalogo-mamielina` en albertos-projects).
- **H3 — dueño de la BD de prod: CERRADO (6-jul).** Dueña:
  `mamielina@myelplay.com` (org `kqsocdyolsnjkvobpsah`); invitados y
  aceptados `nexus@myelplay.com` (la CLI ya ve la BD de prod, verificado) y
  `algopiensa@gmail.com` como respaldo. Falta opcional: MFA en mamielina@ y
  confirmar el renombre de la org a "MyelPlay".
- **Respaldos (plan Free = sin backups automáticos): AUTOMATIZADO (6-jul).**
  `npm run respaldo` (scripts/respaldo.mjs) + LaunchAgent
  `com.myelplay.respaldo-catalogo` (lunes 09:30, corre al despertar):
  pg_dump verificado con pg_restore --list + espejo aditivo de fotos →
  `~/Backups/catalogo/` (retiene 8 dumps; log en respaldo.log; notificación
  macOS si falla). El dump contiene hashes de auth — NO subirlo a ningún lado.
- **Cuando haya clientes PAGANDO** (primer cobro MP real): subir a
  **Supabase Pro** (backups diarios gestionados, 7 días) y **Vercel Pro**
  (repo privado — hoy el código es público —, crons nativos, más límites).
- Huérfanos fuera del team POLGAR: **LIMPIOS (6-jul, Albert)** — borrados el
  `catalogointeligente` viejo y `project-gs7fw` (team nicomaco; quedó solo
  `nicomaco` vivo). `catalogo-mamielina` YA NO EXISTE en albertos-projects
  (ese team solo tiene `myelplay-nexus`, que es producto vivo en
  `nexus.myelplay.com` — NO tocar). Pendiente trivial: confirmar en el
  selector de teams de la cuenta algopiensa que no haya otro team con restos.
- **Entorno de pruebas: HECHO (6-jul, con visto bueno de Albert).** Supabase
  dev `whyqdxwpqdmcpdvrfkke` ("myelplay-agentes-dev", org Myelplay-Nexus —
  nexus@ es Developer en la org MyelPlay y no puede crear proyectos ahí; si
  se quiere junto a prod, subirlo a Administrator y transferir): 28
  migraciones aplicadas, bucket `fotos` public, superadmin
  `admin@myelplay.com` (password en Llavero `supabase-catalogo-dev-superadmin`),
  tienda "demo" sembrada. Envs de **Preview** en Vercel (6: Supabase dev +
  SITE_URL localhost + CRON_SECRET y FIELD_ENCRYPTION_KEY propios de dev).
  Verificado corriendo la app contra la BD dev (/demo 200 con "Tienda Demo",
  /admin/login 200). Los previews de Vercel quedan tras SSO del team
  (Vercel Authentication) — se abren logueado en vercel.com.
- **mamielina.myelplay.com — verify bloqueado por TXT viejo**: en Cloudflare
  hay DOS TXT `_vercel` para mamielina; borrar el que termina en
  `5c33d99ba6fb92da2485` (el del proyecto viejo), conservar el que termina
  en `152ebf69edcf9400a5fe`, y reintentar el verify.

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
| Llavero macOS | `supabase-catalogo-dev-db` | password BD dev (`whyqdxwpqdmcpdvrfkke`) |
| Llavero macOS | `supabase-catalogo-dev-superadmin` | login superadmin del panel en dev |
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
