-- =====================================================================
--  Fase 1 — Líneas de venta y constructor de campos (por tienda)
--  Cada línea (ej. Ropa, Calzado, Varios) tiene sus propios campos.
--  Los campos usan IDs estables: al renombrar/archivar uno NO se pierden
--  los valores guardados en productos.atributos (indexados por campo_id).
-- =====================================================================

-- ---------------------------------------------------------------------
-- lineas_de_venta
-- ---------------------------------------------------------------------
create table if not exists public.lineas_de_venta (
  id                    uuid primary key default gen_random_uuid(),
  tienda_id             uuid not null references public.tiendas (id) on delete cascade,
  nombre                text not null,
  icono                 text not null default '🧺',     -- emoji o nombre de ícono
  color                 text not null default '#A6C972', -- color de la línea
  orden                 integer not null default 0,
  archivada             boolean not null default false,
  lista_espera_override boolean,                          -- NULL = usa el global de la tienda
  creado                timestamptz not null default now()
);

create index if not exists idx_lineas_tienda on public.lineas_de_venta (tienda_id, orden);

-- ---------------------------------------------------------------------
-- campos_linea (form builder)
-- ---------------------------------------------------------------------
create table if not exists public.campos_linea (
  id           uuid primary key default gen_random_uuid(),
  linea_id     uuid not null references public.lineas_de_venta (id) on delete cascade,
  tienda_id    uuid not null references public.tiendas (id) on delete cascade,
  nombre       text not null,
  tipo         text not null default 'texto'
               check (tipo in ('texto','numero','lista','multi','sino')),
  opciones     jsonb not null default '[]'::jsonb,   -- para 'lista' y 'multi'
  obligatorio  boolean not null default false,
  es_filtro    boolean not null default false,        -- aparece como filtro en el catálogo
  orden        integer not null default 0,
  archivado    boolean not null default false,        -- soft-delete: conserva valores
  creado       timestamptz not null default now()
);

create index if not exists idx_campos_linea on public.campos_linea (linea_id, orden);

-- ---------------------------------------------------------------------
-- RLS — lectura pública de tiendas activas; escritura solo quien administra.
-- ---------------------------------------------------------------------
alter table public.lineas_de_venta enable row level security;
alter table public.campos_linea    enable row level security;

-- lineas_de_venta
drop policy if exists lineas_lee on public.lineas_de_venta;
create policy lineas_lee on public.lineas_de_venta for select using (
  public.es_superadmin()
  or tienda_id = public.mi_tienda_id()
  or exists (select 1 from public.tiendas t where t.id = tienda_id and t.activa)
);
drop policy if exists lineas_escribe on public.lineas_de_venta;
create policy lineas_escribe on public.lineas_de_venta for all
  using (public.administra_tienda(tienda_id))
  with check (public.administra_tienda(tienda_id));

-- campos_linea
drop policy if exists campos_lee on public.campos_linea;
create policy campos_lee on public.campos_linea for select using (
  public.es_superadmin()
  or tienda_id = public.mi_tienda_id()
  or exists (select 1 from public.tiendas t where t.id = tienda_id and t.activa)
);
drop policy if exists campos_escribe on public.campos_linea;
create policy campos_escribe on public.campos_linea for all
  using (public.administra_tienda(tienda_id))
  with check (public.administra_tienda(tienda_id));

-- ---------------------------------------------------------------------
-- Semilla de líneas + campos de ejemplo para una tienda nueva.
-- Se llama desde el alta de tienda (Fase 1) o manualmente.
-- ---------------------------------------------------------------------
create or replace function public.sembrar_lineas_demo(p_tienda uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  l_ropa uuid; l_calzado uuid; l_varios uuid;
begin
  insert into public.lineas_de_venta (tienda_id, nombre, icono, color, orden)
    values (p_tienda, 'Ropa', '👕', '#A6C972', 1) returning id into l_ropa;
  insert into public.lineas_de_venta (tienda_id, nombre, icono, color, orden)
    values (p_tienda, 'Calzado', '👟', '#ECA088', 2) returning id into l_calzado;
  insert into public.lineas_de_venta (tienda_id, nombre, icono, color, orden)
    values (p_tienda, 'Varios', '🧸', '#F4C13E', 3) returning id into l_varios;

  insert into public.campos_linea (linea_id, tienda_id, nombre, tipo, opciones, es_filtro, orden) values
    (l_ropa, p_tienda, 'Talla', 'lista', '["0-3m","3-6m","6-12m","1","2","3","4","5","6"]'::jsonb, true, 1),
    (l_ropa, p_tienda, 'Color', 'texto', '[]'::jsonb, true, 2),
    (l_ropa, p_tienda, 'Edad', 'lista', '["Recién nacido","Bebé","Niño pequeño","Niño"]'::jsonb, true, 3),
    (l_calzado, p_tienda, 'Número', 'numero', '[]'::jsonb, true, 1),
    (l_calzado, p_tienda, 'Color', 'texto', '[]'::jsonb, true, 2),
    (l_varios, p_tienda, 'Material', 'texto', '[]'::jsonb, false, 1),
    (l_varios, p_tienda, 'Medidas', 'texto', '[]'::jsonb, false, 2);
end;
$$;
