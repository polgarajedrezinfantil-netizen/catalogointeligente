-- =====================================================================
--  Fase 4 — Controles de apartado para el ADMIN (RPCs autorizadas)
--  Solo quien administra la tienda del producto puede ejecutarlas.
-- =====================================================================

create or replace function public._tienda_de(p_producto uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select tienda_id from public.productos where id = p_producto;
$$;

-- Confirmar apartado: Apartada -> En firme.
create or replace function public.confirmar_admin(p_producto uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_t uuid := public._tienda_de(p_producto);
begin
  if not public.administra_tienda(v_t) then raise exception 'No autorizado'; end if;
  update public.productos set estado='apartada_firme', actualizado=now() where id=p_producto;
  insert into public.eventos_apartado (tienda_id, producto_id, tipo) values (v_t, p_producto, 'confirmar');
end;
$$;

-- Vender: -> Vendida, limpia holder y cola. Acepta precio final opcional.
create or replace function public.vender_admin(p_producto uuid, p_precio_final numeric default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_t uuid := public._tienda_de(p_producto);
begin
  if not public.administra_tienda(v_t) then raise exception 'No autorizado'; end if;
  update public.productos
    set estado='vendida', holder_celular=null, hold_expira=null,
        precio = coalesce(p_precio_final, precio), actualizado=now()
    where id=p_producto;
  delete from public.lista_espera where producto_id=p_producto;
  insert into public.eventos_apartado (tienda_id, producto_id, tipo, meta)
    values (v_t, p_producto, 'vender', jsonb_build_object('precio_final', p_precio_final));
end;
$$;

-- Agotar: -> Agotada, limpia holder y cola.
create or replace function public.agotar_admin(p_producto uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_t uuid := public._tienda_de(p_producto);
begin
  if not public.administra_tienda(v_t) then raise exception 'No autorizado'; end if;
  update public.productos set estado='agotada', holder_celular=null, hold_expira=null, actualizado=now()
    where id=p_producto;
  delete from public.lista_espera where producto_id=p_producto;
  insert into public.eventos_apartado (tienda_id, producto_id, tipo) values (v_t, p_producto, 'agotar');
end;
$$;

-- Liberar a mano: pasa al siguiente de la cola o lo deja Disponible.
create or replace function public.liberar_admin(p_producto uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_t uuid := public._tienda_de(p_producto);
begin
  if not public.administra_tienda(v_t) then raise exception 'No autorizado'; end if;
  insert into public.eventos_apartado (tienda_id, producto_id, tipo) values (v_t, p_producto, 'liberar');
  perform public.avanzar_apartado(p_producto);
end;
$$;

grant execute on function public.confirmar_admin(uuid) to authenticated;
grant execute on function public.vender_admin(uuid, numeric) to authenticated;
grant execute on function public.agotar_admin(uuid) to authenticated;
grant execute on function public.liberar_admin(uuid) to authenticated;

-- La cola y la bitácora también las puede leer el admin para dar seguimiento.
-- (políticas de select ya creadas en 0005)
