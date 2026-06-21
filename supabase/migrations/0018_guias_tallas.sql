-- =====================================================================
--  Guía de tallas — tablas de referencia que la tienda define y el cliente
--  consulta en cada prenda. Puede ser general o por línea de venta (Ropa y
--  Calzado suelen necesitar medidas distintas).
-- =====================================================================

create table if not exists public.guias_tallas (
  id        uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas (id) on delete cascade,
  linea_id  uuid references public.lineas_de_venta (id) on delete set null, -- null = general
  nombre    text not null,
  columnas  jsonb not null default '["Talla","Edad","Estatura"]'::jsonb, -- encabezados
  filas     jsonb not null default '[]'::jsonb,  -- array de arrays (celdas)
  orden     integer not null default 0,
  activa    boolean not null default true,
  creado    timestamptz not null default now()
);
create index if not exists idx_guias_tienda on public.guias_tallas (tienda_id, orden);

alter table public.guias_tallas enable row level security;

-- Lectura pública (catálogo anónimo de una tienda activa); escritura del admin.
drop policy if exists guias_lee on public.guias_tallas;
create policy guias_lee on public.guias_tallas for select using (
  public.es_superadmin()
  or tienda_id = public.mi_tienda_id()
  or exists (select 1 from public.tiendas t where t.id = tienda_id and t.activa)
);
drop policy if exists guias_escribe on public.guias_tallas;
create policy guias_escribe on public.guias_tallas for all
  using (public.administra_tienda(tienda_id))
  with check (public.administra_tienda(tienda_id));
