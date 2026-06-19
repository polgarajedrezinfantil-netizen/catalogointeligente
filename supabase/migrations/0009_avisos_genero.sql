-- =====================================================================
--  C (avisos WhatsApp) + género de producto (niño/niña/unisex) + preguntas
-- =====================================================================

-- 1) Género del producto (para los botones Niño / Niña / Unisex).
alter table public.productos add column if not exists genero text;
do $$ begin
  alter table public.productos
    add constraint productos_genero_chk
    check (genero is null or genero in ('nino', 'nina', 'unisex'));
exception when duplicate_object then null; end $$;

-- 2) Notificaciones / avisos: bandeja del admin + cola de envío por WhatsApp.
create table if not exists public.notificaciones (
  id          uuid primary key default gen_random_uuid(),
  tienda_id   uuid not null references public.tiendas (id) on delete cascade,
  tipo        text not null,                       -- turno | vence | pregunta | carrito
  destino     text not null,                       -- cliente | admin
  celular     text,                                -- número a contactar (wa.me / API)
  producto_id uuid references public.productos (id) on delete set null,
  cuerpo      text not null,
  estado      text not null default 'pendiente',   -- pendiente | enviado
  meta        jsonb not null default '{}'::jsonb,
  creado      timestamptz not null default now()
);
create index if not exists idx_notif_tienda
  on public.notificaciones (tienda_id, estado, creado desc);

alter table public.notificaciones enable row level security;

drop policy if exists notif_admin_sel on public.notificaciones;
create policy notif_admin_sel on public.notificaciones for select
  using (public.administra_tienda(tienda_id));
drop policy if exists notif_admin_upd on public.notificaciones;
create policy notif_admin_upd on public.notificaciones for update
  using (public.administra_tienda(tienda_id));

-- 3) Público: el cliente hace una pregunta sobre un producto -> bandeja admin.
create or replace function public.registrar_pregunta(
  p_tienda uuid, p_celular text, p_producto uuid, p_texto text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_wa text; v_prod text;
begin
  if coalesce(btrim(p_texto), '') = '' then
    return jsonb_build_object('ok', false);
  end if;
  select whatsapp into v_wa from public.tiendas where id = p_tienda;
  select nombre into v_prod from public.productos where id = p_producto;
  insert into public.notificaciones
    (tienda_id, tipo, destino, celular, producto_id, cuerpo, meta)
  values (
    p_tienda, 'pregunta', 'admin', v_wa, p_producto, btrim(p_texto),
    jsonb_build_object('cliente', p_celular, 'producto', coalesce(v_prod, ''))
  );
  return jsonb_build_object('ok', true);
end;
$$;
revoke execute on function public.registrar_pregunta(uuid, text, uuid, text) from public;
grant execute on function public.registrar_pregunta(uuid, text, uuid, text) to anon, authenticated;

-- 4) Re-crear avanzar_apartado añadiendo el aviso automático "es tu turno".
create or replace function public.avanzar_apartado(p_producto uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_sig    record;
  v_hold   integer;
  v_tienda uuid;
  v_nombre text;
begin
  select tienda_id, nombre into v_tienda, v_nombre
    from public.productos where id = p_producto;
  select hold_horas into v_hold from public.tiendas where id = v_tienda;

  select * into v_sig from public.lista_espera
    where producto_id = p_producto order by posicion asc limit 1;

  if found then
    delete from public.lista_espera where id = v_sig.id;
    update public.lista_espera set posicion = posicion - 1
      where producto_id = p_producto;
    update public.productos
      set estado = 'apartada', holder_celular = v_sig.celular,
          hold_expira = now() + make_interval(hours => v_hold),
          actualizado = now()
      where id = p_producto;
    insert into public.eventos_apartado (tienda_id, producto_id, celular, tipo)
      values (v_tienda, p_producto, v_sig.celular, 'pasar_siguiente');
    -- Aviso automático para el nuevo holder.
    insert into public.notificaciones
      (tienda_id, tipo, destino, celular, producto_id, cuerpo)
    values (
      v_tienda, 'turno', 'cliente', v_sig.celular, p_producto,
      '¡Es tu turno! Se liberó "' || coalesce(v_nombre, 'el producto') ||
      '" y quedó apartado para ti.'
    );
  else
    update public.productos
      set estado = 'disponible', holder_celular = null, hold_expira = null,
          actualizado = now()
      where id = p_producto;
  end if;
end;
$$;
revoke execute on function public.avanzar_apartado(uuid) from public;
