-- =====================================================================
--  Fase 7 — CRM: actividad del cliente y bitácora de mensajes
--  eventos_cliente alimenta el perfilado y el dashboard ("más vistos",
--  "más buscados", intereses por línea). mensajes registra el seguimiento.
-- =====================================================================

create table if not exists public.eventos_cliente (
  id        uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas (id) on delete cascade,
  celular   text,
  tipo      text not null,           -- abrir_producto | ver_nido | buscar | apartar | comprar
  ref_id    text,                     -- id de producto / nido (texto)
  meta      jsonb not null default '{}'::jsonb,
  hora      timestamptz not null default now()
);
create index if not exists idx_evcli_tienda on public.eventos_cliente (tienda_id, hora desc);
create index if not exists idx_evcli_celular on public.eventos_cliente (tienda_id, celular);

create table if not exists public.mensajes (
  id          uuid primary key default gen_random_uuid(),
  tienda_id   uuid not null references public.tiendas (id) on delete cascade,
  celular     text,
  canal       text not null default 'whatsapp' check (canal in ('whatsapp','correo')),
  cuerpo      text not null,
  enviado_por uuid references public.perfiles (id),
  hora        timestamptz not null default now()
);
create index if not exists idx_mensajes_tienda on public.mensajes (tienda_id, hora desc);

alter table public.eventos_cliente enable row level security;
alter table public.mensajes        enable row level security;

-- Solo los admins de la tienda leen la actividad y la bitácora.
drop policy if exists evcli_admin on public.eventos_cliente;
create policy evcli_admin on public.eventos_cliente for select
  using (public.administra_tienda(tienda_id));

drop policy if exists mensajes_admin_lee on public.mensajes;
create policy mensajes_admin_lee on public.mensajes for select
  using (public.administra_tienda(tienda_id));
drop policy if exists mensajes_admin_escribe on public.mensajes;
create policy mensajes_admin_escribe on public.mensajes for insert
  with check (public.administra_tienda(tienda_id));

-- RPC pública (anon): registrar actividad del cliente desde el catálogo.
create or replace function public.registrar_evento_cliente(
  p_tienda uuid, p_celular text, p_tipo text, p_ref text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.tiendas where id = p_tienda and activa) then
    return;
  end if;
  insert into public.eventos_cliente (tienda_id, celular, tipo, ref_id)
  values (p_tienda, nullif(p_celular,''), p_tipo, nullif(p_ref,''));
end;
$$;

grant execute on function public.registrar_evento_cliente(uuid, text, text, text) to anon;
