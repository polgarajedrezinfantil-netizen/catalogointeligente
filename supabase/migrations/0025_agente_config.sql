-- =====================================================================
--  AGENTE — Config por tienda EN BASE DE DATOS (reemplaza el mapa TS
--  hardcodeado lib/agente/tenants.ts). Permite dar de alta una tienda desde
--  el panel, sin programar. Dos tablas:
--
--   agente_config   -> identidad/voz/zonas/tallas/guardarraíles (NO secretos).
--                      Editable por el admin de la tienda y por superadmin.
--   agente_secretos -> credenciales de cobro (Mercado Pago OAuth) y canal,
--                      CIFRADAS. Solo superadmin (panel) y el runtime
--                      (service role) las tocan; el admin de tienda NO las lee.
-- =====================================================================

-- ---------------------------------------------------------------------
-- agente_config: la personalidad/operación del agente por tienda.
-- ---------------------------------------------------------------------
create table if not exists public.agente_config (
  tienda_id           uuid primary key references public.tiendas (id) on delete cascade,
  activa              boolean not null default false,   -- el agente atiende esta tienda
  marca               jsonb   not null default '{}'::jsonb,  -- {nombre, asesora, voz, emoji_max, presentacion}
  guardarrailes_extra text[]  not null default '{}',
  origen              jsonb   not null default '{}'::jsonb,   -- {ciudad, zonas_envio:{norte,centro,sur}}
  tallas              text,
  creado              timestamptz not null default now(),
  actualizado         timestamptz not null default now()
);

alter table public.agente_config enable row level security;

drop policy if exists agente_config_super on public.agente_config;
create policy agente_config_super on public.agente_config for all
  using (public.es_superadmin()) with check (public.es_superadmin());

drop policy if exists agente_config_tienda on public.agente_config;
create policy agente_config_tienda on public.agente_config for all
  using (tienda_id = public.mi_tienda_id())
  with check (tienda_id = public.mi_tienda_id());

-- ---------------------------------------------------------------------
-- agente_secretos: credenciales por tienda. Valores sensibles CIFRADOS en app
-- (AES-256-GCM con FIELD_ENCRYPTION_KEY). RLS: SOLO superadmin vía sesión;
-- el runtime entra con service role (salta RLS). El admin/delegado de la
-- tienda NO tiene política -> no puede leer tokens desde el navegador.
-- ---------------------------------------------------------------------
create table if not exists public.agente_secretos (
  tienda_id        uuid primary key references public.tiendas (id) on delete cascade,
  -- Mercado Pago (OAuth / Marketplace)
  mp_conectado     boolean not null default false,
  mp_user_id       text,            -- collector_id de la cuenta del cliente (no secreto)
  mp_public_key    text,
  mp_access_token  text,            -- CIFRADO
  mp_refresh_token text,            -- CIFRADO
  mp_expira        timestamptz,
  -- WhatsApp Cloud API (token de envío por tienda, opcional)
  wa_token         text,            -- CIFRADO
  actualizado      timestamptz not null default now()
);

alter table public.agente_secretos enable row level security;

drop policy if exists agente_secretos_super on public.agente_secretos;
create policy agente_secretos_super on public.agente_secretos for all
  using (public.es_superadmin()) with check (public.es_superadmin());
-- (sin política para admin/delegado: los secretos no se leen desde el cliente)
