-- =====================================================================
--  MAMIELINA / Los Nidos — Migración base (Fase 0) · SaaS multi-tienda
--  Modelo: una sola base con aislamiento por `tienda_id` vía RLS.
--  Roles: superadmin (gestiona todas las tiendas) · admin / delegado (su tienda).
--  Links públicos por ruta: nidos.myelplay.com/<slug-tienda>/<nido>.
--  Las tablas del catálogo (líneas, productos, nidos, etc.) llegan en fases
--  siguientes; todas llevarán `tienda_id` + RLS análoga.
-- =====================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_cron";     -- tareas programadas (vencimientos)

-- ---------------------------------------------------------------------
-- planes: el superadmin asigna un plan a cada tienda; define el máximo
-- de catálogos (Nidos) activos. max_catalogos = NULL => ilimitado.
-- ---------------------------------------------------------------------
create table if not exists public.planes (
  clave         text primary key,         -- 'basico' | 'pro' | 'ilimitado'
  nombre        text not null,
  max_catalogos integer,                   -- NULL = ilimitado
  orden         integer not null default 0
);

insert into public.planes (clave, nombre, max_catalogos, orden) values
  ('basico',     'Básico',     3,    1),
  ('pro',        'Pro',        10,   2),
  ('ilimitado',  'Ilimitado',  null, 3)
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------
-- tiendas: cada tenant del SaaS. Incluye su configuración (lo que antes
-- era config_tienda, ahora por tienda).
-- ---------------------------------------------------------------------
create table if not exists public.tiendas (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text unique not null,        -- para el link /<slug>/...
  nombre                 text not null,
  plan_clave             text not null default 'basico' references public.planes (clave),
  activa                 boolean not null default true,
  -- configuración de la tienda
  logo_url               text,
  whatsapp               text,
  hold_horas             integer not null default 6,  -- caducidad del apartado
  lista_espera_global    boolean not null default true,
  moneda                 text not null default 'MXN',
  etiqueta_precio        text not null default '$',
  ganancia_default       numeric not null default 0.5, -- 0.5 = +50% sobre el costo
  precio_general_default numeric,
  whatsapp_api_activa    boolean not null default false,
  whatsapp_api_config    jsonb not null default '{}'::jsonb,
  email_api_config       jsonb not null default '{}'::jsonb,
  creado                 timestamptz not null default now(),
  actualizado            timestamptz not null default now()
);

create index if not exists idx_tiendas_slug on public.tiendas (slug);

-- ---------------------------------------------------------------------
-- perfiles: usuarios (1:1 con auth.users). superadmin no tiene tienda.
-- ---------------------------------------------------------------------
create table if not exists public.perfiles (
  id        uuid primary key references auth.users (id) on delete cascade,
  nombre    text not null default 'Usuario',
  rol       text not null default 'admin' check (rol in ('superadmin','admin','delegado')),
  tienda_id uuid references public.tiendas (id) on delete cascade,
  creado    timestamptz not null default now(),
  -- un superadmin no pertenece a tienda; un admin/delegado sí
  constraint perfil_tienda_coherente check (
    (rol = 'superadmin' and tienda_id is null) or
    (rol in ('admin','delegado') and tienda_id is not null)
  )
);

create index if not exists idx_perfiles_tienda on public.perfiles (tienda_id);

-- ---------------------------------------------------------------------
-- Helpers de autorización (SECURITY DEFINER para leer perfiles sin recursión)
-- ---------------------------------------------------------------------
create or replace function public.es_superadmin()
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'superadmin');
$$;

-- tienda del usuario actual (NULL si superadmin o anónimo)
create or replace function public.mi_tienda_id()
returns uuid language sql security definer set search_path = public as $$
  select tienda_id from public.perfiles where id = auth.uid();
$$;

-- ¿el usuario actual administra la tienda t? (su tienda o es superadmin)
create or replace function public.administra_tienda(t uuid)
returns boolean language sql security definer set search_path = public as $$
  select public.es_superadmin() or (t is not null and t = public.mi_tienda_id());
$$;

-- Máximo de catálogos activos permitido a una tienda según su plan.
create or replace function public.limite_catalogos(t uuid)
returns integer language sql stable set search_path = public as $$
  select p.max_catalogos
  from public.tiendas s
  join public.planes p on p.clave = s.plan_clave
  where s.id = t;
$$;

-- Al crear un usuario en Auth, se crea su perfil desde la metadata que
-- pone el superadmin al invitar: {rol, nombre, tienda_id}.
create or replace function public.crear_perfil_invitado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.raw_user_meta_data ? 'rol') then
    insert into public.perfiles (id, nombre, rol, tienda_id)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
      coalesce(new.raw_user_meta_data ->> 'rol', 'admin'),
      nullif(new.raw_user_meta_data ->> 'tienda_id', '')::uuid
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_crear_perfil_invitado on auth.users;
create trigger trg_crear_perfil_invitado
  after insert on auth.users
  for each row execute function public.crear_perfil_invitado();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.planes   enable row level security;
alter table public.tiendas  enable row level security;
alter table public.perfiles enable row level security;

-- planes: lectura para todos; escritura solo superadmin.
drop policy if exists planes_lee on public.planes;
create policy planes_lee on public.planes for select using (true);
drop policy if exists planes_super on public.planes;
create policy planes_super on public.planes for all
  using (public.es_superadmin()) with check (public.es_superadmin());

-- tiendas:
--  - lectura pública SOLO de tiendas activas (el catálogo las resuelve por slug)
--  - el superadmin ve/gestiona todas
--  - el admin lee/edita su propia tienda
drop policy if exists tiendas_lee_publico on public.tiendas;
create policy tiendas_lee_publico on public.tiendas for select using (activa = true);
drop policy if exists tiendas_super_lee on public.tiendas;
create policy tiendas_super_lee on public.tiendas for select using (public.es_superadmin());
drop policy if exists tiendas_super_todo on public.tiendas;
create policy tiendas_super_todo on public.tiendas for all
  using (public.es_superadmin()) with check (public.es_superadmin());
drop policy if exists tiendas_admin_edita on public.tiendas;
create policy tiendas_admin_edita on public.tiendas for update
  using (id = public.mi_tienda_id()) with check (id = public.mi_tienda_id());

-- perfiles:
--  - cada quien lee su propio perfil
--  - superadmin: todo
--  - admin: ve los perfiles de su tienda
drop policy if exists perfiles_propio on public.perfiles;
create policy perfiles_propio on public.perfiles for select using (id = auth.uid());
drop policy if exists perfiles_super on public.perfiles;
create policy perfiles_super on public.perfiles for all
  using (public.es_superadmin()) with check (public.es_superadmin());
drop policy if exists perfiles_misma_tienda on public.perfiles;
create policy perfiles_misma_tienda on public.perfiles for select
  using (tienda_id is not null and tienda_id = public.mi_tienda_id());

-- ---------------------------------------------------------------------
-- pg_cron: placeholder. En la Fase 4 se registra el barrido de apartados
-- vencidos (por tienda):
--   select cron.schedule('vencer-apartados','* * * * *',
--     $$ select public.procesar_vencidos() $$);
-- ---------------------------------------------------------------------
