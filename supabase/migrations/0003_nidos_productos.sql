-- =====================================================================
--  Fase 2 — Nidos (catálogos) y Productos (con fotos reales)
--  Un "catálogo activo" = un Nido activo. El plan limita cuántos puede
--  tener activos cada tienda (planes.max_catalogos).
-- =====================================================================

-- Estados del apartado (la lógica completa llega en la Fase 4).
do $$ begin
  create type public.estado_producto as enum
    ('disponible','apartada','apartada_firme','vendida','agotada');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- nidos: cada colección/catálogo de la tienda
-- ---------------------------------------------------------------------
create table if not exists public.nidos (
  id               uuid primary key default gen_random_uuid(),
  tienda_id        uuid not null references public.tiendas (id) on delete cascade,
  nombre           text not null,
  fecha            date not null default current_date,
  foto_portada_url text,
  orden            integer not null default 0,
  es_nuevo         boolean not null default true,
  activo           boolean not null default true,   -- cuenta para el límite del plan
  creado           timestamptz not null default now()
);
create index if not exists idx_nidos_tienda on public.nidos (tienda_id, orden);

-- ---------------------------------------------------------------------
-- productos
-- ---------------------------------------------------------------------
create table if not exists public.productos (
  id                  uuid primary key default gen_random_uuid(),
  tienda_id           uuid not null references public.tiendas (id) on delete cascade,
  linea_id            uuid references public.lineas_de_venta (id) on delete set null,
  nido_id             uuid references public.nidos (id) on delete set null,
  nombre              text not null,
  descripcion         text,
  precio              numeric not null default 0,
  costo               numeric not null default 0,
  cantidad            integer not null default 1,   -- piezas iguales
  fotos               jsonb not null default '[]'::jsonb,  -- paths en Storage
  atributos           jsonb not null default '{}'::jsonb,  -- por campo_id
  categoria           text,
  estado              public.estado_producto not null default 'disponible',
  holder_celular      text,
  hold_expira         timestamptz,
  precios_encontrados jsonb not null default '[]'::jsonb,  -- del módulo IA
  creado              timestamptz not null default now(),
  actualizado         timestamptz not null default now()
);
create index if not exists idx_productos_tienda on public.productos (tienda_id);
create index if not exists idx_productos_nido on public.productos (nido_id);
create index if not exists idx_productos_linea on public.productos (linea_id);

-- ---------------------------------------------------------------------
-- Límite de catálogos activos por plan (se valida al activar un Nido).
-- ---------------------------------------------------------------------
create or replace function public.valida_limite_nidos()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_limite integer;
  v_activos integer;
begin
  if new.activo then
    select max_catalogos into v_limite
      from public.tiendas s join public.planes p on p.clave = s.plan_clave
      where s.id = new.tienda_id;
    if v_limite is not null then
      select count(*) into v_activos from public.nidos
        where tienda_id = new.tienda_id and activo and id <> new.id;
      if v_activos >= v_limite then
        raise exception 'Límite del plan alcanzado: % catálogos activos', v_limite
          using errcode = 'check_violation';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_limite_nidos on public.nidos;
create trigger trg_limite_nidos
  before insert or update of activo on public.nidos
  for each row execute function public.valida_limite_nidos();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.nidos     enable row level security;
alter table public.productos enable row level security;

drop policy if exists nidos_lee on public.nidos;
create policy nidos_lee on public.nidos for select using (
  public.es_superadmin()
  or tienda_id = public.mi_tienda_id()
  or exists (select 1 from public.tiendas t where t.id = tienda_id and t.activa)
);
drop policy if exists nidos_escribe on public.nidos;
create policy nidos_escribe on public.nidos for all
  using (public.administra_tienda(tienda_id))
  with check (public.administra_tienda(tienda_id));

drop policy if exists productos_lee on public.productos;
create policy productos_lee on public.productos for select using (
  public.es_superadmin()
  or tienda_id = public.mi_tienda_id()
  or exists (select 1 from public.tiendas t where t.id = tienda_id and t.activa)
);
drop policy if exists productos_escribe on public.productos;
create policy productos_escribe on public.productos for all
  using (public.administra_tienda(tienda_id))
  with check (public.administra_tienda(tienda_id));

-- ---------------------------------------------------------------------
-- Storage: bucket 'fotos' — lectura pública, escritura solo perfiles.
-- ---------------------------------------------------------------------
drop policy if exists fotos_lee on storage.objects;
create policy fotos_lee on storage.objects for select
  using (bucket_id = 'fotos');

drop policy if exists fotos_admin_inserta on storage.objects;
create policy fotos_admin_inserta on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos'
    and exists (select 1 from public.perfiles where id = auth.uid()));

drop policy if exists fotos_admin_actualiza on storage.objects;
create policy fotos_admin_actualiza on storage.objects for update to authenticated
  using (bucket_id = 'fotos'
    and exists (select 1 from public.perfiles where id = auth.uid()));

drop policy if exists fotos_admin_borra on storage.objects;
create policy fotos_admin_borra on storage.objects for delete to authenticated
  using (bucket_id = 'fotos'
    and exists (select 1 from public.perfiles where id = auth.uid()));
