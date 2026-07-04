# 🍯 Los Nidos de Mamielina

Mini-SaaS para la tienda **MAMIELINA**: catálogo en línea con apartado en vivo,
panel de administración, identificación de productos con IA, CRM de clientes y
finanzas. Construido con **Next.js 16 (App Router) + Tailwind v4 + Supabase**.

> Cada colección es un **Nido**. La marca los presenta como *Los Nidos de Mamielina*.

---

## 1. Requisitos
- Node 20+ y npm
- Una cuenta de **Supabase** (proyecto nuevo)
- Llaves de **Anthropic** (IA). Opcionales por fase: SerpAPI, Mercado Pago, Belvo.

## 2. Configurar variables de entorno
1. Copia la plantilla:
   ```bash
   cp .env.example .env.local
   ```
2. Rellena tus llaves. **Dónde sacarlas:** ver `REVISION-CERO.md`.
   - **Supabase** → app.supabase.com → Project Settings → **API**:
     - *Project URL* → `NEXT_PUBLIC_SUPABASE_URL`
     - *anon public* → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - *service_role* → `SUPABASE_SERVICE_ROLE_KEY` (¡secreta!)
   - **Anthropic** → console.anthropic.com → API Keys → `ANTHROPIC_API_KEY`
   - Secretos internos:
     ```bash
     openssl rand -hex 32   # -> FIELD_ENCRYPTION_KEY
     openssl rand -hex 16   # -> CRON_SECRET
     ```
3. Verifica que todo conecta:
   ```bash
   npm run check:env
   ```

## 3. Base de datos (migraciones)
Las migraciones viven en `supabase/migrations/`. Para aplicarlas necesitas el
**Supabase CLI** y vincular tu proyecto:
```bash
brew install supabase/tap/supabase     # instalar CLI (una vez)
supabase login                          # inicia sesión
supabase link --project-ref TU_REF      # TU_REF está en la URL del proyecto
supabase db push                        # aplica las migraciones
```
> En Storage, crea un bucket público llamado **`fotos`**.

### Modelo SaaS multi-tienda (MyelPlay Agentes)
El producto vive en `agentes.myelplay.com` (panel del operador) y cada tienda
cliente en su subdominio `<tienda>.myelplay.com` (ej. `mamielina.myelplay.com`).
Una sola base aislada por `tienda_id` con RLS (Opción 1). Roles: **superadmin**
(gestiona todas las tiendas y asigna planes/límites), **admin** y **delegado**
(operan SU tienda). Cada tienda tiene un `slug` y su catálogo se comparte como
`<tienda>.myelplay.com/<slug>`. Los **planes** (`basico`=3, `pro`=10,
`ilimitado`) definen el máximo de catálogos activos por tienda. El **agente IA**
es un add-on por tienda: sin alta en `agente_config`, el panel de esa tienda no
muestra los módulos del agente.

### Primer superadmin
1. En Supabase → **Authentication → Users → Add user** (email + contraseña).
2. En **SQL Editor**, autorízalo como superadmin:
   ```sql
   insert into public.perfiles (id, nombre, rol)
   values ('<UUID_DEL_USUARIO>', 'Tu Nombre', 'superadmin');
   ```
   (El UUID aparece en la lista de usuarios. El superadmin NO lleva tienda_id.)
3. Desde el panel de superadmin (Fase 1+) se crean tiendas e invitan sus
   admins. Las invitaciones llevan metadata
   `{"rol":"admin","nombre":"...","tienda_id":"<uuid>"}` y el perfil se crea
   solo (trigger `crear_perfil_invitado`).

## 4. Desarrollo
```bash
npm run dev
```
Abre http://localhost:3000 — inicio · `/catalogo` (público) · `/admin` (panel).

## 5. Desplegar en Vercel
1. Sube el código a tu repo de GitHub.
2. vercel.com → **Add New → Project** → importa el repo (detecta Next.js).
3. En **Environment Variables**, pega las mismas de `.env.local`.
4. **Deploy**. Configura el dominio del catálogo para compartir el link.

---

## Identidad visual
Definida en `app/globals.css` (tokens de marca) a partir de
`public/brand/mamielina_brand_board.html`. Paleta miel/crema/verde-mielina/
durazno/sol/cacao; tipografías Fredoka, Baloo 2, Nunito y Caveat.

## Estructura
```
app/            rutas (inicio, /catalogo, /admin)
components/     UI y elementos gráficos de marca
lib/supabase/   clientes browser / server / service-role + sesión
proxy.ts        protege /admin y refresca sesión (ex-middleware, Next 16)
supabase/       migraciones SQL
scripts/        utilidades (check:env)
```

## Estado por fases
- **Fase 0 — Scaffolding** ✅ (este commit)
- Fase 1 — Configuración (líneas, campos, tienda)
- Fase 2 — Panel admin (Nidos, productos, fotos)
- Fase 3 — Catálogo público (filtros dinámicos)
- Fase 4 — Apartado inteligente + tiempo real
- Fase 5 — Nidos estilo historias
- Fase 6 — Identificación IA + ganancia
- Fase 7 — Dashboard + CRM
- Fase 8 — Finanzas (Mercado Pago)
- Fase 9 — Importador PDF + seed
