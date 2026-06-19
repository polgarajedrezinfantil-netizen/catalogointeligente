-- =====================================================================
--  Fase 3 — Captura de cliente y solicitudes ("¿buscas algo?")
--  El catálogo público (anónimo) registra al cliente y sus búsquedas vía
--  RPCs SECURITY DEFINER. El CRM completo (perfil, mensajería) es Fase 7.
-- =====================================================================

create table if not exists public.clientes (
  id            uuid primary key default gen_random_uuid(),
  tienda_id     uuid not null references public.tiendas (id) on delete cascade,
  celular       text not null,
  nombre        text,
  correo        text,
  nidos_vistos  jsonb not null default '[]'::jsonb,
  creado        timestamptz not null default now(),
  ultima_visita timestamptz not null default now(),
  unique (tienda_id, celular)
);
create index if not exists idx_clientes_tienda on public.clientes (tienda_id);

create table if not exists public.solicitudes_cliente (
  id        uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas (id) on delete cascade,
  celular   text,
  texto     text not null,
  estado    text not null default 'abierta' check (estado in ('abierta','atendida')),
  creado    timestamptz not null default now()
);
create index if not exists idx_solicitudes_tienda on public.solicitudes_cliente (tienda_id);

-- ---------------------------------------------------------------------
-- RLS: solo los admins de la tienda leen; el público escribe vía RPC.
-- ---------------------------------------------------------------------
alter table public.clientes            enable row level security;
alter table public.solicitudes_cliente enable row level security;

drop policy if exists clientes_admin on public.clientes;
create policy clientes_admin on public.clientes for select
  using (public.administra_tienda(tienda_id));

drop policy if exists solicitudes_admin_lee on public.solicitudes_cliente;
create policy solicitudes_admin_lee on public.solicitudes_cliente for select
  using (public.administra_tienda(tienda_id));
drop policy if exists solicitudes_admin_edita on public.solicitudes_cliente;
create policy solicitudes_admin_edita on public.solicitudes_cliente for update
  using (public.administra_tienda(tienda_id)) with check (public.administra_tienda(tienda_id));

-- ---------------------------------------------------------------------
-- RPCs públicas (anon) — solo escriben en la tienda indicada si está activa.
-- ---------------------------------------------------------------------
create or replace function public.registrar_cliente(
  p_tienda uuid, p_celular text, p_nombre text, p_correo text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.tiendas where id = p_tienda and activa) then
    raise exception 'Tienda no disponible';
  end if;
  insert into public.clientes (tienda_id, celular, nombre, correo)
  values (p_tienda, p_celular, nullif(p_nombre,''), nullif(p_correo,''))
  on conflict (tienda_id, celular) do update
    set nombre = coalesce(nullif(excluded.nombre,''), public.clientes.nombre),
        correo = coalesce(nullif(excluded.correo,''), public.clientes.correo),
        ultima_visita = now();
end;
$$;

create or replace function public.registrar_solicitud(
  p_tienda uuid, p_celular text, p_texto text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.tiendas where id = p_tienda and activa) then
    raise exception 'Tienda no disponible';
  end if;
  if length(coalesce(p_texto,'')) = 0 then return; end if;
  insert into public.solicitudes_cliente (tienda_id, celular, texto)
  values (p_tienda, nullif(p_celular,''), p_texto);
end;
$$;

-- Marca un Nido como visto por un cliente (para la fila estilo historias, Fase 5).
create or replace function public.marcar_nido_visto(
  p_tienda uuid, p_celular text, p_nido uuid
) returns void language plpgsql security definer set search_path = public as $$
begin
  update public.clientes
    set nidos_vistos = (
      select jsonb_agg(distinct e) from jsonb_array_elements(
        nidos_vistos || to_jsonb(p_nido::text)
      ) e
    ),
    ultima_visita = now()
  where tienda_id = p_tienda and celular = p_celular;
end;
$$;

-- Permite a anónimos ejecutar estas RPCs.
grant execute on function public.registrar_cliente(uuid, text, text, text) to anon;
grant execute on function public.registrar_solicitud(uuid, text, text) to anon;
grant execute on function public.marcar_nido_visto(uuid, text, uuid) to anon;
