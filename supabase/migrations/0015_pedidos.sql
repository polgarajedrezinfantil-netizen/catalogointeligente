-- =====================================================================
--  Pedidos — flujo de compra interino (antes de Mercado Pago automático)
--
--  El cliente arma su carrito (productos que apartó), toca "Generar pedido"
--  y se crea un PEDIDO con sus datos + las prendas. Grecia lo ve en el panel,
--  coordina el pago y, al recibirlo, lo CONFIRMA → las prendas quedan VENDIDAS.
--  Cancelar un pedido libera las prendas (vuelven a estar disponibles).
-- =====================================================================

create table if not exists public.pedidos (
  id              uuid primary key default gen_random_uuid(),
  tienda_id       uuid not null references public.tiendas (id) on delete cascade,
  folio           integer not null,                 -- consecutivo por tienda (#1, #2, …)
  cliente_celular text,
  cliente_nombre  text,
  cliente_correo  text,
  items           jsonb not null default '[]'::jsonb, -- [{producto_id, nombre, precio}]
  subtotal        numeric not null default 0,
  cupon           text,
  descuento       numeric not null default 0,
  total           numeric not null default 0,
  estado          text not null default 'pendiente'
                  check (estado in ('pendiente','pagado','cancelado')),
  creado          timestamptz not null default now(),
  confirmado_en   timestamptz,
  unique (tienda_id, folio)
);
create index if not exists idx_pedidos_tienda on public.pedidos (tienda_id, creado desc);

-- Enlace producto → pedido (para confirmar/cancelar en bloque).
alter table public.productos
  add column if not exists pedido_id uuid references public.pedidos (id) on delete set null;

alter table public.pedidos enable row level security;

-- Solo el admin de la tienda ve y edita sus pedidos. El público escribe vía RPC.
drop policy if exists pedidos_admin_sel on public.pedidos;
create policy pedidos_admin_sel on public.pedidos for select
  using (public.administra_tienda(tienda_id));
drop policy if exists pedidos_admin_upd on public.pedidos;
create policy pedidos_admin_upd on public.pedidos for update
  using (public.administra_tienda(tienda_id)) with check (public.administra_tienda(tienda_id));

-- ---------------------------------------------------------------------
-- Público: crea un pedido a partir de las prendas que el cliente apartó.
-- Reconstruye nombre/precio del lado servidor (no confía en el cliente),
-- revalida el cupón y deja las prendas "En firme" ligadas al pedido.
-- Devuelve {ok, folio, total, pedido_id}.
-- ---------------------------------------------------------------------
create or replace function public.crear_pedido(
  p_tienda  uuid,
  p_celular text,
  p_nombre  text,
  p_ids     jsonb,            -- array de producto_id (texto)
  p_cupon   text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ids        uuid[];
  v_items      jsonb := '[]'::jsonb;
  v_subtotal   numeric := 0;
  v_pct        numeric := 0;
  v_pal        text := null;
  v_descuento  numeric := 0;
  v_total      numeric := 0;
  v_folio      integer;
  v_pedido     uuid;
  v_nombre     text;
  v_correo     text;
  r            record;
begin
  if not exists (select 1 from public.tiendas where id = p_tienda and activa) then
    raise exception 'Tienda no disponible';
  end if;

  select array_agg(value::uuid) into v_ids
    from jsonb_array_elements_text(coalesce(p_ids, '[]'::jsonb));
  if v_ids is null or array_length(v_ids, 1) is null then
    return jsonb_build_object('ok', false, 'error', 'carrito_vacio');
  end if;

  -- Solo prendas de esta tienda que el cliente realmente tiene apartadas.
  for r in
    select id, nombre,
           coalesce(precio_oferta, precio) as precio
      from public.productos
     where id = any(v_ids)
       and tienda_id = p_tienda
       and holder_celular = p_celular
       and estado in ('apartada','apartada_firme')
  loop
    v_items := v_items || jsonb_build_object(
      'producto_id', r.id, 'nombre', r.nombre, 'precio', r.precio);
    v_subtotal := v_subtotal + r.precio;
  end loop;

  if jsonb_array_length(v_items) = 0 then
    return jsonb_build_object('ok', false, 'error', 'sin_prendas');
  end if;

  -- Revalida el cupón del lado servidor.
  if coalesce(btrim(p_cupon), '') <> '' then
    select porcentaje, palabra into v_pct, v_pal
      from public.cupones
     where tienda_id = p_tienda and activo
       and lower(btrim(palabra)) = lower(btrim(p_cupon))
     limit 1;
    if v_pct is null then v_pct := 0; v_pal := null; end if;
  end if;
  v_descuento := round(v_subtotal * v_pct / 100);
  v_total := v_subtotal - v_descuento;

  -- Datos del cliente (de su ficha; cae al nombre local si no hay).
  select nombre, correo into v_nombre, v_correo
    from public.clientes where tienda_id = p_tienda and celular = p_celular;
  v_nombre := coalesce(nullif(v_nombre, ''), nullif(p_nombre, ''));

  v_folio := coalesce((select max(folio) from public.pedidos where tienda_id = p_tienda), 0) + 1;

  insert into public.pedidos (
    tienda_id, folio, cliente_celular, cliente_nombre, cliente_correo,
    items, subtotal, cupon, descuento, total)
  values (
    p_tienda, v_folio, p_celular, v_nombre, v_correo,
    v_items, v_subtotal, v_pal, v_descuento, v_total)
  returning id into v_pedido;

  -- Las prendas del pedido quedan "En firme" ligadas a este pedido.
  update public.productos
     set estado = 'apartada_firme', pedido_id = v_pedido, actualizado = now()
   where id = any(v_ids) and tienda_id = p_tienda and holder_celular = p_celular
     and estado in ('apartada','apartada_firme');

  insert into public.eventos_apartado (tienda_id, producto_id, celular, tipo, meta)
    values (p_tienda, null, p_celular, 'pedido',
            jsonb_build_object('folio', v_folio, 'total', v_total));

  return jsonb_build_object('ok', true, 'folio', v_folio, 'total', v_total, 'pedido_id', v_pedido);
end;
$$;

-- ---------------------------------------------------------------------
-- Admin: confirma el pago de un pedido → sus prendas quedan VENDIDAS.
-- ---------------------------------------------------------------------
create or replace function public.confirmar_pedido(p_pedido uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_t uuid;
begin
  select tienda_id into v_t from public.pedidos where id = p_pedido;
  if v_t is null then raise exception 'Pedido no encontrado'; end if;
  if not public.administra_tienda(v_t) then raise exception 'No autorizado'; end if;

  update public.pedidos
     set estado = 'pagado', confirmado_en = now()
   where id = p_pedido and estado = 'pendiente';

  delete from public.lista_espera
   where producto_id in (select id from public.productos where pedido_id = p_pedido);

  update public.productos
     set estado = 'vendida', holder_celular = null, hold_expira = null, actualizado = now()
   where pedido_id = p_pedido;

  insert into public.eventos_apartado (tienda_id, producto_id, tipo, meta)
    values (v_t, null, 'pedido_pagado', jsonb_build_object('pedido', p_pedido));
end;
$$;

-- ---------------------------------------------------------------------
-- Admin: cancela un pedido → libera sus prendas (pasan al siguiente o quedan
-- disponibles). No vende nada.
-- ---------------------------------------------------------------------
create or replace function public.cancelar_pedido(p_pedido uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_t uuid; r record;
begin
  select tienda_id into v_t from public.pedidos where id = p_pedido;
  if v_t is null then raise exception 'Pedido no encontrado'; end if;
  if not public.administra_tienda(v_t) then raise exception 'No autorizado'; end if;

  update public.pedidos set estado = 'cancelado' where id = p_pedido and estado = 'pendiente';

  for r in select id from public.productos where pedido_id = p_pedido loop
    update public.productos set pedido_id = null where id = r.id;
    perform public.avanzar_apartado(r.id);
  end loop;

  insert into public.eventos_apartado (tienda_id, producto_id, tipo, meta)
    values (v_t, null, 'pedido_cancelado', jsonb_build_object('pedido', p_pedido));
end;
$$;

grant execute on function public.crear_pedido(uuid, text, text, jsonb, text) to anon;
grant execute on function public.confirmar_pedido(uuid) to authenticated;
grant execute on function public.cancelar_pedido(uuid) to authenticated;
