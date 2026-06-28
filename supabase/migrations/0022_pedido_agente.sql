-- =====================================================================
--  AGENTE IA DE VENTAS — Fase 3: cobro
--
--  El cliente del agente (WhatsApp/IG/FB) NO pasa por el flujo web de
--  "apartado". Llega chateando, el agente le arma el pedido y le manda el
--  link de pago. Por eso necesitamos un camino propio para crear pedidos
--  que NO dependa de que la prenda ya esté 'apartada' por el cliente.
--
--    crear_pedido_agente  -> arma el pedido desde el chat y RESERVA las prendas
--                            (estado 'apartada_firme' ligadas al pedido).
--    pagar_pedido_agente  -> la llama el webhook de Mercado Pago al confirmarse
--                            el pago. Idempotente (MP reintenta). Marca el pedido
--                            'pagado', las prendas 'vendida' y la venta del agente.
--
--  Ambas SECURITY DEFINER. El runtime las invoca con la SERVICE ROLE.
--  Para confirmar/cancelar a mano desde el panel se siguen usando las de 0015
--  (confirmar_pedido / cancelar_pedido), que validan administra_tienda().
-- =====================================================================

-- ---------------------------------------------------------------------
-- crear_pedido_agente: arma un pedido a partir de IDs de producto elegidos
-- en la conversación. Reconstruye nombre/precio del lado servidor (no confía
-- en el agente), solo toma prendas DISPONIBLES de la tienda, revalida el cupón
-- y deja las prendas "en firme" ligadas al pedido (reservadas para este cliente).
-- Devuelve {ok, folio, total, pedido_id, items, omitidos}.
-- ---------------------------------------------------------------------
create or replace function public.crear_pedido_agente(
  p_tienda  uuid,
  p_celular text,
  p_nombre  text,
  p_ids     jsonb,            -- array de producto_id (texto)
  p_cupon   text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ids        uuid[];
  v_items      jsonb := '[]'::jsonb;
  v_tomados    uuid[] := '{}';
  v_subtotal   numeric := 0;
  v_pct        numeric := 0;
  v_pal        text := null;
  v_descuento  numeric := 0;
  v_total      numeric := 0;
  v_folio      integer;
  v_pedido     uuid;
  v_nombre     text;
  v_correo     text;
  v_pedidos    integer;
  v_omitidos   integer;
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

  -- Solo prendas DISPONIBLES de esta tienda (no ocultas, con existencia).
  -- Bloqueamos las filas para evitar doble venta si dos chats coinciden.
  for r in
    select id, nombre, coalesce(precio_oferta, precio) as precio
      from public.productos
     where id = any(v_ids)
       and tienda_id = p_tienda
       and oculto = false
       and estado = 'disponible'
       and cantidad > 0
     for update
  loop
    v_items   := v_items || jsonb_build_object(
                   'producto_id', r.id, 'nombre', r.nombre, 'precio', r.precio);
    v_tomados := array_append(v_tomados, r.id);
    v_subtotal := v_subtotal + r.precio;
  end loop;

  if jsonb_array_length(v_items) = 0 then
    return jsonb_build_object('ok', false, 'error', 'sin_disponibles');
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

  -- Datos del cliente (de su ficha CRM si existe; si no, lo que dio el chat).
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

  -- Reserva las prendas tomadas: quedan "en firme" ligadas al pedido.
  update public.productos
     set estado = 'apartada_firme', holder_celular = p_celular,
         hold_expira = null, pedido_id = v_pedido, actualizado = now()
   where id = any(v_tomados);

  insert into public.eventos_apartado (tienda_id, producto_id, celular, tipo, meta)
    values (p_tienda, null, p_celular, 'pedido',
            jsonb_build_object('folio', v_folio, 'total', v_total, 'origen', 'agente'));

  v_omitidos := array_length(v_ids, 1) - array_length(v_tomados, 1);

  return jsonb_build_object(
    'ok', true, 'folio', v_folio, 'total', v_total, 'pedido_id', v_pedido,
    'items', v_items, 'omitidos', coalesce(v_omitidos, 0));
end;
$$;

-- ---------------------------------------------------------------------
-- pagar_pedido_agente: la llama el webhook de Mercado Pago al aprobarse el
-- pago. Marca el pedido 'pagado', sus prendas 'vendida', limpia listas de
-- espera y cierra la venta del agente. IDEMPOTENTE: si ya estaba pagado no
-- vuelve a tocar nada (MP puede reintentar el webhook varias veces).
-- Devuelve {ok, tienda_id, folio, ya_pagado}.
-- ---------------------------------------------------------------------
create or replace function public.pagar_pedido_agente(p_pedido uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_t      uuid;
  v_folio  integer;
  v_estado text;
begin
  select tienda_id, folio, estado into v_t, v_folio, v_estado
    from public.pedidos where id = p_pedido;
  if v_t is null then
    return jsonb_build_object('ok', false, 'error', 'pedido_no_encontrado');
  end if;

  if v_estado = 'pagado' then
    return jsonb_build_object('ok', true, 'tienda_id', v_t, 'folio', v_folio, 'ya_pagado', true);
  end if;

  update public.pedidos
     set estado = 'pagado', confirmado_en = now()
   where id = p_pedido and estado = 'pendiente';

  delete from public.lista_espera
   where producto_id in (select id from public.productos where pedido_id = p_pedido);

  update public.productos
     set estado = 'vendida', holder_celular = null, hold_expira = null, actualizado = now()
   where pedido_id = p_pedido;

  update public.agente_ventas
     set estado = 'pagado'
   where pedido_id = p_pedido;

  insert into public.eventos_apartado (tienda_id, producto_id, tipo, meta)
    values (v_t, null, 'pedido_pagado',
            jsonb_build_object('pedido', p_pedido, 'origen', 'agente'));

  return jsonb_build_object('ok', true, 'tienda_id', v_t, 'folio', v_folio, 'ya_pagado', false);
end;
$$;

-- El runtime del agente y el webhook usan la SERVICE ROLE.
grant execute on function public.crear_pedido_agente(uuid, text, text, jsonb, text) to service_role;
grant execute on function public.pagar_pedido_agente(uuid) to service_role;
