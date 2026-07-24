-- =====================================================================
--  Pedidos — cerrar el ciclo de vida y tapar un hueco de seguridad
--
--  Qué faltaba:
--   1. Si confirmabas un pago por error, no había vuelta atrás.
--   2. No existía la devolución: una prenda vendida y devuelta se quedaba
--      "vendida" para siempre y el dinero seguía contando como ingreso.
--   3. BUG: en cancelar_pedido el UPDATE del pedido estaba protegido con
--      "and estado = 'pendiente'", pero el bucle que libera las prendas NO.
--      Llamar la RPC sobre un pedido YA PAGADO (está grant-eada a
--      'authenticated') dejaba el pedido en 'pagado' y, aun así, le quitaba
--      el pedido_id a las prendas vendidas y ejecutaba avanzar_apartado:
--      le avisaba "¡es tu turno!" a alguien por una prenda ya vendida.
--   4. confirmar_pedido (la del panel) no marcaba la venta del agente como
--      pagada —solo lo hacía el webhook de Mercado Pago—, así que confirmar
--      un pedido de chat a mano dejaba las métricas del agente en $0.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Nuevo estado 'devuelto' + rastro de por qué y cuándo.
-- ---------------------------------------------------------------------
-- El check viejo se creó inline en el create table, así que su nombre lo puso
-- Postgres. Lo buscamos en vez de adivinarlo: si el nombre no coincidiera,
-- el constraint seguiría vivo y rechazaría 'devuelto' en silencio.
do $$
declare r record;
begin
  for r in
    select con.conname
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'pedidos' and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%estado%'
  loop
    execute format('alter table public.pedidos drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.pedidos add constraint pedidos_estado_check
  check (estado in ('pendiente', 'pagado', 'cancelado', 'devuelto'));

alter table public.pedidos
  add column if not exists motivo      text,
  add column if not exists devuelto_en timestamptz,
  add column if not exists actualizado timestamptz not null default now();

-- ---------------------------------------------------------------------
-- 2) Confirmar pago (panel). Ahora exige que el pedido esté pendiente y
--    sincroniza la venta atribuida al agente.
-- ---------------------------------------------------------------------
create or replace function public.confirmar_pedido(p_pedido uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_t uuid; v_estado text;
begin
  select tienda_id, estado into v_t, v_estado from public.pedidos where id = p_pedido;
  if v_t is null then raise exception 'Pedido no encontrado'; end if;
  if not public.administra_tienda(v_t) then raise exception 'No autorizado'; end if;
  if v_estado <> 'pendiente' then
    raise exception 'Solo se puede confirmar un pedido pendiente (está: %)', v_estado;
  end if;

  update public.pedidos
     set estado = 'pagado', confirmado_en = now(), actualizado = now()
   where id = p_pedido;

  delete from public.lista_espera
   where producto_id in (select id from public.productos where pedido_id = p_pedido);

  update public.productos
     set estado = 'vendida', holder_celular = null, hold_expira = null, actualizado = now()
   where pedido_id = p_pedido;

  -- Si el pedido nació de un chat, la venta del agente queda cobrada.
  update public.agente_ventas set estado = 'pagado' where pedido_id = p_pedido;

  insert into public.eventos_apartado (tienda_id, producto_id, tipo, meta)
    values (v_t, null, 'pedido_pagado', jsonb_build_object('pedido', p_pedido));
end;
$$;

-- ---------------------------------------------------------------------
-- 3) Cancelar (solo pendientes) — libera las prendas. Con el guardia
--    completo: si el pedido no está pendiente, no toca NADA.
-- ---------------------------------------------------------------------
-- Sin DEFAULT en p_motivo a propósito: convive con el envoltorio de un solo
-- argumento del final del archivo, y con default la llamada de 1 argumento
-- sería ambigua para Postgres.
create or replace function public.cancelar_pedido(p_pedido uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v_t uuid; v_estado text; r record;
begin
  select tienda_id, estado into v_t, v_estado from public.pedidos where id = p_pedido;
  if v_t is null then raise exception 'Pedido no encontrado'; end if;
  if not public.administra_tienda(v_t) then raise exception 'No autorizado'; end if;
  if v_estado <> 'pendiente' then
    raise exception 'Solo se puede cancelar un pedido pendiente (está: %). Si ya está pagado, usa Revertir pago o Devolución.', v_estado;
  end if;

  update public.pedidos
     set estado = 'cancelado',
         motivo = nullif(btrim(coalesce(p_motivo, '')), ''),
         actualizado = now()
   where id = p_pedido;

  for r in select id from public.productos where pedido_id = p_pedido loop
    update public.productos set pedido_id = null where id = r.id;
    perform public.avanzar_apartado(r.id);
  end loop;

  update public.agente_ventas set estado = 'cancelado' where pedido_id = p_pedido;

  insert into public.eventos_apartado (tienda_id, producto_id, tipo, meta)
    values (v_t, null, 'pedido_cancelado', jsonb_build_object('pedido', p_pedido));
end;
$$;

-- ---------------------------------------------------------------------
-- 4) Revertir el pago: "lo confirmé por error". El pedido vuelve a
--    pendiente y sus prendas dejan de estar vendidas, pero siguen
--    reservadas para el mismo cliente (no se devuelven al catálogo).
--
--    Ojo: al confirmar se borró la lista de espera de esas prendas; eso
--    no se puede reconstruir. Quien estuviera formado ya no lo está.
-- ---------------------------------------------------------------------
create or replace function public.revertir_pago_pedido(p_pedido uuid, p_motivo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_t uuid; v_estado text; v_cel text;
begin
  select tienda_id, estado, cliente_celular into v_t, v_estado, v_cel
    from public.pedidos where id = p_pedido;
  if v_t is null then raise exception 'Pedido no encontrado'; end if;
  if not public.administra_tienda(v_t) then raise exception 'No autorizado'; end if;
  if v_estado <> 'pagado' then
    raise exception 'Solo se puede revertir un pedido pagado (está: %)', v_estado;
  end if;

  update public.pedidos
     set estado = 'pendiente', confirmado_en = null,
         motivo = nullif(btrim(coalesce(p_motivo, '')), ''),
         actualizado = now()
   where id = p_pedido;

  -- Solo las prendas que siguen ligadas a este pedido y siguen vendidas:
  -- si la tienda ya las movió a mano, no las pisamos.
  update public.productos
     set estado = 'apartada_firme', holder_celular = v_cel,
         hold_expira = null, actualizado = now()
   where pedido_id = p_pedido and estado = 'vendida';

  update public.agente_ventas set estado = 'link_enviado' where pedido_id = p_pedido;

  insert into public.eventos_apartado (tienda_id, producto_id, tipo, meta)
    values (v_t, null, 'pedido_pago_revertido',
            jsonb_build_object('pedido', p_pedido, 'motivo', p_motivo));
end;
$$;

-- ---------------------------------------------------------------------
-- 5) Devolución: el cliente pagó, se llevó la prenda y la regresó.
--    La venta deja de contar y las prendas vuelven al catálogo (o pasan
--    al siguiente de la cola, si alguien se formó después).
-- ---------------------------------------------------------------------
create or replace function public.devolver_pedido(p_pedido uuid, p_motivo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_t uuid; v_estado text; r record;
begin
  select tienda_id, estado into v_t, v_estado from public.pedidos where id = p_pedido;
  if v_t is null then raise exception 'Pedido no encontrado'; end if;
  if not public.administra_tienda(v_t) then raise exception 'No autorizado'; end if;
  if v_estado <> 'pagado' then
    raise exception 'Solo se puede devolver un pedido pagado (está: %)', v_estado;
  end if;

  update public.pedidos
     set estado = 'devuelto', devuelto_en = now(),
         motivo = nullif(btrim(coalesce(p_motivo, '')), ''),
         actualizado = now()
   where id = p_pedido;

  for r in
    select id from public.productos where pedido_id = p_pedido and estado = 'vendida'
  loop
    update public.productos set pedido_id = null where id = r.id;
    perform public.avanzar_apartado(r.id);
  end loop;

  update public.agente_ventas set estado = 'cancelado' where pedido_id = p_pedido;

  insert into public.eventos_apartado (tienda_id, producto_id, tipo, meta)
    values (v_t, null, 'pedido_devuelto',
            jsonb_build_object('pedido', p_pedido, 'motivo', p_motivo));
end;
$$;

-- La firma vieja (un solo argumento) se queda como envoltorio que delega en
-- la nueva: así el panel ya desplegado sigue funcionando entre que se aplica
-- esta migración y sale el deploy, pero ya con el guardia puesto.
create or replace function public.cancelar_pedido(p_pedido uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.cancelar_pedido(p_pedido, null);
end;
$$;

revoke execute on function public.cancelar_pedido(uuid)             from public, anon;
revoke execute on function public.cancelar_pedido(uuid, text)       from public, anon;
grant  execute on function public.cancelar_pedido(uuid)             to authenticated;
revoke execute on function public.revertir_pago_pedido(uuid, text)  from public, anon;
revoke execute on function public.devolver_pedido(uuid, text)       from public, anon;
grant  execute on function public.cancelar_pedido(uuid, text)       to authenticated;
grant  execute on function public.revertir_pago_pedido(uuid, text)  to authenticated;
grant  execute on function public.devolver_pedido(uuid, text)       to authenticated;
