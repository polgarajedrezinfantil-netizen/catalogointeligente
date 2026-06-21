-- =====================================================================
--  Evita pedidos duplicados: un pedido nuevo solo toma las prendas que el
--  cliente tiene "apartadas" (recién pedidas), NO las que ya quedaron
--  "en firme" dentro de un pedido anterior.
-- =====================================================================

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

  -- Solo prendas apartadas (no las que ya están en un pedido = 'apartada_firme').
  for r in
    select id, nombre,
           coalesce(precio_oferta, precio) as precio
      from public.productos
     where id = any(v_ids)
       and tienda_id = p_tienda
       and holder_celular = p_celular
       and estado = 'apartada'
       and pedido_id is null
  loop
    v_items := v_items || jsonb_build_object(
      'producto_id', r.id, 'nombre', r.nombre, 'precio', r.precio);
    v_subtotal := v_subtotal + r.precio;
  end loop;

  if jsonb_array_length(v_items) = 0 then
    return jsonb_build_object('ok', false, 'error', 'sin_prendas');
  end if;

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

  update public.productos
     set estado = 'apartada_firme', pedido_id = v_pedido, actualizado = now()
   where id = any(v_ids) and tienda_id = p_tienda and holder_celular = p_celular
     and estado = 'apartada' and pedido_id is null;

  insert into public.eventos_apartado (tienda_id, producto_id, celular, tipo, meta)
    values (p_tienda, null, p_celular, 'pedido',
            jsonb_build_object('folio', v_folio, 'total', v_total));

  return jsonb_build_object('ok', true, 'folio', v_folio, 'total', v_total, 'pedido_id', v_pedido);
end;
$$;
