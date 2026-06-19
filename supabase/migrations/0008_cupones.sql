-- =====================================================================
--  Cupones de descuento
--  El admin define palabra -> % de descuento. El cliente la escribe en el
--  carrito y se valida con una RPC pública (sin exponer la lista de claves).
-- =====================================================================

create table if not exists public.cupones (
  id         uuid primary key default gen_random_uuid(),
  tienda_id  uuid not null references public.tiendas (id) on delete cascade,
  palabra    text not null,
  porcentaje numeric not null check (porcentaje > 0 and porcentaje <= 100),
  activo     boolean not null default true,
  creado     timestamptz not null default now()
);

-- Una palabra única por tienda (sin importar mayúsculas/espacios).
create unique index if not exists idx_cupon_palabra
  on public.cupones (tienda_id, lower(btrim(palabra)));

alter table public.cupones enable row level security;

-- Solo los admins de la tienda gestionan sus cupones.
drop policy if exists cupones_admin_sel on public.cupones;
create policy cupones_admin_sel on public.cupones for select
  using (public.administra_tienda(tienda_id));
drop policy if exists cupones_admin_ins on public.cupones;
create policy cupones_admin_ins on public.cupones for insert
  with check (public.administra_tienda(tienda_id));
drop policy if exists cupones_admin_upd on public.cupones;
create policy cupones_admin_upd on public.cupones for update
  using (public.administra_tienda(tienda_id));
drop policy if exists cupones_admin_del on public.cupones;
create policy cupones_admin_del on public.cupones for delete
  using (public.administra_tienda(tienda_id));

-- ---------------------------------------------------------------------
-- Público: valida una palabra y devuelve el % de descuento.
-- No expone la lista de cupones; solo responde por la palabra exacta.
-- ---------------------------------------------------------------------
create or replace function public.validar_cupon(p_tienda uuid, p_palabra text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_pct numeric; v_pal text;
begin
  select porcentaje, palabra into v_pct, v_pal
    from public.cupones
    where tienda_id = p_tienda
      and activo
      and lower(btrim(palabra)) = lower(btrim(p_palabra))
    limit 1;
  if v_pct is null then
    return jsonb_build_object('valido', false);
  end if;
  return jsonb_build_object('valido', true, 'porcentaje', v_pct, 'palabra', v_pal);
end;
$$;

revoke execute on function public.validar_cupon(uuid, text) from public;
grant execute on function public.validar_cupon(uuid, text) to anon, authenticated;
