-- =====================================================================
--  AGENTE IA DE VENTAS — Migración del runtime del agente (Fase 0)
--  Mismo SaaS multi-tienda: aislamiento por `tienda_id` vía RLS, igual que
--  el catálogo. El agente reusa `tiendas`, `perfiles`, `pedidos` y el catálogo.
--
--  Tablas (prefijo `agente_` para no chocar con tablas existentes como la
--  `mensajes` del CRM):
--    agente_canales        -> mapea un identificador de canal Meta a una tienda.
--                             El router resuelve aquí a qué tenant pertenece.
--    agente_conversaciones -> un hilo agente<->cliente en un canal (handoff).
--    agente_mensajes       -> cada mensaje del hilo (cliente/agente/humano/sistema).
--    agente_ventas         -> ventas atribuidas a una conversación (liga a pedidos).
--
--  Acceso:
--    - superadmin: todo.
--    - admin/delegado: solo su tienda.
--    - El RUNTIME (webhook, sin sesión) escribe con la SERVICE ROLE key, que
--      salta RLS. Estas tablas NO son públicas (a diferencia del catálogo).
-- =====================================================================

-- ---------------------------------------------------------------------
-- agente_canales: a qué tienda pertenece cada identificador de canal de Meta.
--   external_id = whatsapp_phone_number_id | page_id_facebook | ig_account_id
-- ---------------------------------------------------------------------
create table if not exists public.agente_canales (
  id          uuid primary key default gen_random_uuid(),
  tienda_id   uuid not null references public.tiendas (id) on delete cascade,
  tipo        text not null check (tipo in ('whatsapp','messenger','instagram')),
  external_id text not null,                       -- id del canal en Meta
  nombre      text,                                -- etiqueta legible
  activo      boolean not null default true,
  config      jsonb not null default '{}'::jsonb,  -- overrides no sensibles (secretos cifrados, no aquí)
  creado      timestamptz not null default now(),
  unique (tipo, external_id)                       -- un id de Meta -> una sola tienda
);

create index if not exists idx_agente_canales_tienda on public.agente_canales (tienda_id);

-- ---------------------------------------------------------------------
-- agente_conversaciones: un hilo agente<->cliente en un canal.
--   estado: 'abierta' (la lleva el agente) | 'en_humano' (handoff) | 'cerrada'
-- ---------------------------------------------------------------------
create table if not exists public.agente_conversaciones (
  id                 uuid primary key default gen_random_uuid(),
  tienda_id          uuid not null references public.tiendas (id) on delete cascade,
  canal_id           uuid references public.agente_canales (id) on delete set null,
  tipo_canal         text,                          -- denormalizado (whatsapp/messenger/instagram)
  cliente_externo_id text not null,                 -- id del cliente en el canal (wa id / PSID / ig id)
  cliente_nombre     text,
  cliente_celular    text,
  estado             text not null default 'abierta'
                       check (estado in ('abierta','en_humano','cerrada')),
  asignado_a         uuid references public.perfiles (id) on delete set null, -- humano que tomó el control
  ultimo_mensaje_en  timestamptz not null default now(),
  creado             timestamptz not null default now()
);

create index if not exists idx_agente_conv_tienda on public.agente_conversaciones (tienda_id);
create index if not exists idx_agente_conv_bandeja on public.agente_conversaciones (tienda_id, ultimo_mensaje_en desc);
create index if not exists idx_agente_conv_cliente on public.agente_conversaciones (canal_id, cliente_externo_id);

-- ---------------------------------------------------------------------
-- agente_mensajes: cada mensaje del hilo. `tienda_id` denormalizado para RLS.
--   rol: 'cliente' | 'agente' | 'humano' | 'sistema'
--   external_id: id del mensaje en Meta (dedupe de entrantes / idempotencia).
-- ---------------------------------------------------------------------
create table if not exists public.agente_mensajes (
  id              uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references public.agente_conversaciones (id) on delete cascade,
  tienda_id       uuid not null references public.tiendas (id) on delete cascade,
  rol             text not null check (rol in ('cliente','agente','humano','sistema')),
  contenido       text,
  adjuntos        jsonb not null default '[]'::jsonb,   -- urls de media
  external_id     text,                                  -- id del mensaje en Meta
  meta            jsonb not null default '{}'::jsonb,    -- modelo, tokens, latencia, etc.
  creado          timestamptz not null default now()
);

create index if not exists idx_agente_msg_conv on public.agente_mensajes (conversacion_id, creado);
create index if not exists idx_agente_msg_tienda on public.agente_mensajes (tienda_id);
create unique index if not exists uq_agente_msg_external on public.agente_mensajes (external_id)
  where external_id is not null;

-- ---------------------------------------------------------------------
-- agente_ventas: ventas atribuidas a una conversación. Liga a `pedidos`.
--   estado: 'propuesta' | 'link_enviado' | 'pagado' | 'cancelado'
-- ---------------------------------------------------------------------
create table if not exists public.agente_ventas (
  id              uuid primary key default gen_random_uuid(),
  tienda_id       uuid not null references public.tiendas (id) on delete cascade,
  conversacion_id uuid references public.agente_conversaciones (id) on delete set null,
  pedido_id       uuid references public.pedidos (id) on delete set null,
  canal           text,
  monto           numeric not null default 0,
  estado          text not null default 'propuesta'
                    check (estado in ('propuesta','link_enviado','pagado','cancelado')),
  creado          timestamptz not null default now()
);

create index if not exists idx_agente_ventas_tienda on public.agente_ventas (tienda_id, creado desc);

-- ---------------------------------------------------------------------
-- RLS: superadmin todo; admin/delegado solo su tienda. Sin lectura pública.
--      El runtime ingiere con la service role (salta RLS).
-- ---------------------------------------------------------------------
alter table public.agente_canales        enable row level security;
alter table public.agente_conversaciones enable row level security;
alter table public.agente_mensajes       enable row level security;
alter table public.agente_ventas         enable row level security;

-- agente_canales
drop policy if exists agente_canales_super on public.agente_canales;
create policy agente_canales_super on public.agente_canales for all
  using (public.es_superadmin()) with check (public.es_superadmin());
drop policy if exists agente_canales_tienda on public.agente_canales;
create policy agente_canales_tienda on public.agente_canales for all
  using (tienda_id = public.mi_tienda_id())
  with check (tienda_id = public.mi_tienda_id());

-- agente_conversaciones
drop policy if exists agente_conv_super on public.agente_conversaciones;
create policy agente_conv_super on public.agente_conversaciones for all
  using (public.es_superadmin()) with check (public.es_superadmin());
drop policy if exists agente_conv_tienda on public.agente_conversaciones;
create policy agente_conv_tienda on public.agente_conversaciones for all
  using (tienda_id = public.mi_tienda_id())
  with check (tienda_id = public.mi_tienda_id());

-- agente_mensajes
drop policy if exists agente_msg_super on public.agente_mensajes;
create policy agente_msg_super on public.agente_mensajes for all
  using (public.es_superadmin()) with check (public.es_superadmin());
drop policy if exists agente_msg_tienda on public.agente_mensajes;
create policy agente_msg_tienda on public.agente_mensajes for all
  using (tienda_id = public.mi_tienda_id())
  with check (tienda_id = public.mi_tienda_id());

-- agente_ventas
drop policy if exists agente_ventas_super on public.agente_ventas;
create policy agente_ventas_super on public.agente_ventas for all
  using (public.es_superadmin()) with check (public.es_superadmin());
drop policy if exists agente_ventas_tienda on public.agente_ventas;
create policy agente_ventas_tienda on public.agente_ventas for all
  using (tienda_id = public.mi_tienda_id())
  with check (tienda_id = public.mi_tienda_id());
