-- =====================================================================
--  CRM (fase A) — la lista de clientes deja de calcularse en el navegador
--
--  Antes: /admin/clientes bajaba clientes + productos + líneas + TODOS los
--  eventos y los cruzaba en JS (clientes × eventos × productos). Con unos
--  cientos de clientes la página se arrastraba y crecía sin fin.
--
--  Ahora: Postgres devuelve UNA página ya resuelta (25 filas), con búsqueda,
--  filtros y orden. Los intereses —lo caro— se calculan solo para las filas
--  visibles, no para toda la base.
--
--  Añade además la capa propia del CRM sobre `clientes`: etiquetas, nota
--  privada y "no molestar".
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Campos de CRM en la ficha del cliente.
-- ---------------------------------------------------------------------
alter table public.clientes
  add column if not exists etiquetas   text[]  not null default '{}',
  add column if not exists nota        text,
  add column if not exists no_molestar boolean not null default false;

-- ---------------------------------------------------------------------
-- 2) Índices que faltaban para cruzar por cliente.
--    eventos_apartado solo tenía índice por (tienda, hora): buscar por
--    celular era escaneo completo.
-- ---------------------------------------------------------------------
create index if not exists idx_evap_celular
  on public.eventos_apartado (tienda_id, celular);
create index if not exists idx_pedidos_cliente
  on public.pedidos (tienda_id, cliente_celular);
create index if not exists idx_solicitudes_celular
  on public.solicitudes_cliente (tienda_id, celular);
create index if not exists idx_mensajes_celular
  on public.mensajes (tienda_id, celular);

-- ---------------------------------------------------------------------
-- 3) Página de clientes: búsqueda + filtro + orden + paginación en SQL.
--
--    p_filtro: todos | compradores | pendientes | nuevos | dormidos | solicitudes
--    p_orden : reciente | gastado | pedidos | nombre
--    Devuelve {total, pagina, por, filas:[…]}.
-- ---------------------------------------------------------------------
create or replace function public.clientes_pagina(
  p_tienda uuid,
  p_q      text    default null,
  p_filtro text    default 'todos',
  p_orden  text    default 'reciente',
  p_pagina integer default 1,
  p_por    integer default 25
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_q      text;
  v_dig    text;
  v_por    integer := least(greatest(coalesce(p_por, 25), 1), 100);
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
  v_res    jsonb;
begin
  if not public.administra_tienda(p_tienda) then
    raise exception 'No autorizado';
  end if;

  v_q := nullif(btrim(coalesce(p_q, '')), '');

  -- El celular solo se busca cuando la consulta ES un teléfono (dígitos y
  -- signos de marcado). Si no, "Cliente 5" dejaría el dígito 5 suelto y
  -- casaría con todos los celulares que contengan un 5, o sea con todos.
  v_dig := case
             when v_q ~ '^[0-9+()\s.\-]+$'
             then nullif(regexp_replace(v_q, '\D', '', 'g'), '')
           end;

  with base as (
    -- Cada cliente con su resumen de pedidos y solicitudes abiertas.
    select
      c.celular,
      c.nombre,
      c.correo,
      c.ultima_visita,
      c.etiquetas,
      coalesce(btrim(c.nota), '') <> ''         as tiene_nota,
      c.no_molestar,
      coalesce(pd.n, 0)                         as pedidos,
      coalesce(pd.pagados, 0)                   as pagados,
      coalesce(pd.pendientes, 0)                as pendientes,
      coalesce(pd.gastado, 0)                   as gastado,
      pd.ultimo                                 as ultimo_pedido,
      coalesce(so.n, 0)                         as solicitudes
    from public.clientes c
    left join (
      select cliente_celular,
             count(*)::int                                           as n,
             count(*) filter (where estado = 'pagado')::int           as pagados,
             count(*) filter (where estado = 'pendiente')::int        as pendientes,
             coalesce(sum(total) filter (where estado = 'pagado'), 0) as gastado,
             max(creado)                                             as ultimo
        from public.pedidos
       where tienda_id = p_tienda and cliente_celular is not null
       group by cliente_celular
    ) pd on pd.cliente_celular = c.celular
    left join (
      select celular, count(*)::int as n
        from public.solicitudes_cliente
       where tienda_id = p_tienda and estado = 'abierta' and celular is not null
       group by celular
    ) so on so.celular = c.celular
    where c.tienda_id = p_tienda
      and (
        v_q is null
        or c.nombre ilike '%' || v_q || '%'
        or c.correo ilike '%' || v_q || '%'
        or (v_dig is not null and c.celular like '%' || v_dig || '%')
      )
  ),
  filtrada as (
    -- Segmentos calculados. En la fase B los sustituye la etapa persistida.
    select * from base
     where case coalesce(p_filtro, 'todos')
             when 'compradores' then pagados > 0
             when 'pendientes'  then pendientes > 0
             when 'nuevos'      then pedidos = 0
             when 'dormidos'    then ultima_visita < now() - interval '60 days'
             when 'solicitudes' then solicitudes > 0
             else true
           end
  ),
  total as (
    select count(*)::int as n from filtrada
  ),
  pagina as (
    select f.*, row_number() over (
             order by
               case when p_orden = 'gastado' then gastado end desc nulls last,
               case when p_orden = 'pedidos' then pedidos end desc nulls last,
               case when p_orden = 'nombre'  then lower(coalesce(nombre, 'zzz')) end asc nulls last,
               case when coalesce(p_orden, 'reciente') not in ('gastado','pedidos','nombre')
                    then ultima_visita end desc nulls last,
               f.celular
           ) as rn
      from filtrada f
     order by rn
     limit v_por offset (v_pagina - 1) * v_por
  ),
  -- Solo aquí se calculan los intereses: sobre las ≤100 filas de la página,
  -- nunca sobre la base completa.
  conintereses as (
    select p.*, it.intereses
      from pagina p
      cross join lateral (
        select coalesce(array_agg(x.nombre order by x.n desc), '{}') as intereses
          from (
            select l.nombre, count(*) as n
              from (
                select producto_id::text as pid
                  from public.eventos_apartado
                 where tienda_id = p_tienda and celular = p.celular
                   and tipo = 'apartar' and producto_id is not null
                union all
                select ref_id
                  from public.eventos_cliente
                 where tienda_id = p_tienda and celular = p.celular
                   and tipo = 'abrir_producto' and ref_id is not null
              ) ev
              join public.productos pr
                on pr.id::text = ev.pid and pr.tienda_id = p_tienda
              join public.lineas_de_venta l on l.id = pr.linea_id
             group by l.nombre
             order by count(*) desc
             limit 3
          ) x
      ) it
  )
  select jsonb_build_object(
    'total',  (select n from total),
    'pagina', v_pagina,
    'por',    v_por,
    'filas',  coalesce((
      select jsonb_agg(jsonb_build_object(
               'celular',       c.celular,
               'nombre',        c.nombre,
               'correo',        c.correo,
               'ultima_visita', c.ultima_visita,
               'etiquetas',     to_jsonb(c.etiquetas),
               'tiene_nota',    c.tiene_nota,
               'no_molestar',   c.no_molestar,
               'pedidos',       c.pedidos,
               'pagados',       c.pagados,
               'pendientes',    c.pendientes,
               'gastado',       c.gastado,
               'ultimo_pedido', c.ultimo_pedido,
               'solicitudes',   c.solicitudes,
               'intereses',     to_jsonb(c.intereses)
             ) order by c.rn)
        from conintereses c), '[]'::jsonb)
  ) into v_res;

  return v_res;
end;
$$;

-- ---------------------------------------------------------------------
-- 4) Ficha completa de un cliente: resumen + línea de tiempo.
--    Devuelve null si el celular no existe en esta tienda.
-- ---------------------------------------------------------------------
create or replace function public.cliente_ficha(p_tienda uuid, p_celular text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_cli   record;
  v_ficha jsonb;
begin
  if not public.administra_tienda(p_tienda) then
    raise exception 'No autorizado';
  end if;

  select * into v_cli from public.clientes
   where tienda_id = p_tienda and celular = p_celular;
  if not found then return null; end if;

  select jsonb_build_object(
    'cliente', jsonb_build_object(
      'celular',       v_cli.celular,
      'nombre',        v_cli.nombre,
      'correo',        v_cli.correo,
      'creado',        v_cli.creado,
      'ultima_visita', v_cli.ultima_visita,
      'etiquetas',     to_jsonb(v_cli.etiquetas),
      'nota',          v_cli.nota,
      'no_molestar',   v_cli.no_molestar
    ),

    'resumen', (
      select jsonb_build_object(
        'pedidos',       count(*),
        'pagados',       count(*) filter (where estado = 'pagado'),
        'pendientes',    count(*) filter (where estado = 'pendiente'),
        'gastado',       coalesce(sum(total) filter (where estado = 'pagado'), 0),
        'ticket',        coalesce(round(avg(total) filter (where estado = 'pagado'), 2), 0),
        'primer_pedido', min(creado),
        'ultimo_pedido', max(creado))
        from public.pedidos
       where tienda_id = p_tienda and cliente_celular = p_celular
    ),

    'intereses', coalesce((
      select jsonb_agg(jsonb_build_object('nombre', x.nombre, 'n', x.n) order by x.n desc)
        from (
          select l.nombre, count(*) as n
            from (
              select producto_id::text as pid
                from public.eventos_apartado
               where tienda_id = p_tienda and celular = p_celular
                 and tipo = 'apartar' and producto_id is not null
              union all
              select ref_id
                from public.eventos_cliente
               where tienda_id = p_tienda and celular = p_celular
                 and tipo = 'abrir_producto' and ref_id is not null
            ) ev
            join public.productos pr
              on pr.id::text = ev.pid and pr.tienda_id = p_tienda
            join public.lineas_de_venta l on l.id = pr.linea_id
           group by l.nombre order by count(*) desc limit 6
        ) x
    ), '[]'::jsonb),

    'pedidos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'folio', p.folio, 'estado', p.estado, 'total', p.total,
               'creado', p.creado, 'items', jsonb_array_length(p.items)) order by p.creado desc)
        from (select * from public.pedidos
               where tienda_id = p_tienda and cliente_celular = p_celular
               order by creado desc limit 20) p
    ), '[]'::jsonb),

    'solicitudes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'texto', s.texto, 'estado', s.estado, 'creado', s.creado)
               order by s.creado desc)
        from (select * from public.solicitudes_cliente
               where tienda_id = p_tienda and celular = p_celular
               order by creado desc limit 20) s
    ), '[]'::jsonb),

    'mensajes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'canal', m.canal, 'cuerpo', m.cuerpo, 'hora', m.hora) order by m.hora desc)
        from (select * from public.mensajes
               where tienda_id = p_tienda and celular = p_celular
               order by hora desc limit 20) m
    ), '[]'::jsonb),

    'conversaciones', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', id, 'canal', tipo_canal, 'estado', estado,
               'ultimo', ultimo_mensaje_en) order by ultimo_mensaje_en desc)
        from public.agente_conversaciones
       where tienda_id = p_tienda
         and (cliente_celular = p_celular or cliente_externo_id = p_celular)
    ), '[]'::jsonb),

    'actividad', coalesce((
      select jsonb_agg(jsonb_build_object(
               'tipo', a.tipo, 'nombre', a.nombre, 'hora', a.hora) order by a.hora desc)
        from (
          select e.tipo, pr.nombre, e.hora
            from public.eventos_cliente e
            left join public.productos pr on pr.id::text = e.ref_id
           where e.tienda_id = p_tienda and e.celular = p_celular
           union all
          select e.tipo, pr.nombre, e.hora
            from public.eventos_apartado e
            left join public.productos pr on pr.id = e.producto_id
           where e.tienda_id = p_tienda and e.celular = p_celular
           order by hora desc limit 40
        ) a
    ), '[]'::jsonb)
  ) into v_ficha;

  return v_ficha;
end;
$$;

-- ---------------------------------------------------------------------
-- 5) Guardar los campos de CRM. Vía RPC (no política de UPDATE abierta):
--    así el admin solo puede tocar nota/etiquetas/no_molestar, nunca el
--    celular ni la tienda de la ficha.
--    Cada parámetro en null = "no cambies este campo".
-- ---------------------------------------------------------------------
create or replace function public.guardar_cliente_crm(
  p_tienda      uuid,
  p_celular     text,
  p_nota        text    default null,
  p_etiquetas   text[]  default null,
  p_no_molestar boolean default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.administra_tienda(p_tienda) then
    raise exception 'No autorizado';
  end if;

  update public.clientes
     set nota        = case when p_nota is null then nota else nullif(btrim(p_nota), '') end,
         etiquetas   = coalesce(p_etiquetas, etiquetas),
         no_molestar = coalesce(p_no_molestar, no_molestar)
   where tienda_id = p_tienda and celular = p_celular;

  if not found then raise exception 'Cliente no encontrado'; end if;
end;
$$;

revoke execute on function public.clientes_pagina(uuid, text, text, text, integer, integer) from public, anon;
revoke execute on function public.cliente_ficha(uuid, text) from public, anon;
revoke execute on function public.guardar_cliente_crm(uuid, text, text, text[], boolean) from public, anon;
grant execute on function public.clientes_pagina(uuid, text, text, text, integer, integer) to authenticated;
grant execute on function public.cliente_ficha(uuid, text) to authenticated;
grant execute on function public.guardar_cliente_crm(uuid, text, text, text[], boolean) to authenticated;
