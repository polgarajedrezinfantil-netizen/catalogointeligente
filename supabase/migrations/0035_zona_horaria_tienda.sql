-- =====================================================================
--  La agenda del CRM necesita saber qué día es EN LA TIENDA
--
--  El seguimiento ("le escribo el jueves") se compara contra "hoy", y hasta
--  ahora "hoy" era current_date, que en Supabase es UTC. Para una tienda en
--  Ciudad Juárez (UTC-6/-7) eso significa que a las 5 ó 6 de la tarde el
--  segmento "A seguir hoy" se vaciaba solo y lo agendado para mañana
--  aparecía como vencido. Cada tienda declara su zona y se acabó.
--
--  El mismo desfase existía en el navegador: la ficha calculaba "mañana"
--  contra la fecha del equipo de quien mira. Ahora las RPCs devuelven el
--  'hoy' de la tienda y la pantalla se apoya en él.
-- =====================================================================

alter table public.tiendas
  add column if not exists zona_horaria text not null default 'America/Mexico_City';

-- Qué día es ahora mismo en la tienda. Si alguien guarda una zona inválida,
-- no tumbamos la página: se cae a la hora de México.
create or replace function public.hoy_tienda(p_tienda uuid)
returns date language plpgsql stable security definer set search_path = public as $$
declare v_zona text;
begin
  select coalesce(nullif(btrim(zona_horaria), ''), 'America/Mexico_City')
    into v_zona from public.tiendas where id = p_tienda;
  begin
    return (now() at time zone coalesce(v_zona, 'America/Mexico_City'))::date;
  exception when others then
    return (now() at time zone 'America/Mexico_City')::date;
  end;
end;
$$;

-- ---------------------------------------------------------------------
-- Seguimiento: además de una fecha exacta, acepta "en N días" y los cuenta
-- desde el hoy de la tienda. Antes los atajos ("mañana", "en 3 días") se
-- calculaban en el servidor de Vercel, que corre en UTC.
--
-- Se elimina la firma anterior en vez de dejar las dos: con p_dias por
-- omisión, una llamada de 4 argumentos sería ambigua para Postgres.
-- ---------------------------------------------------------------------
drop function if exists public.guardar_seguimiento_cliente(uuid, text, date, text);

create or replace function public.guardar_seguimiento_cliente(
  p_tienda  uuid,
  p_celular text,
  p_fecha   date,
  p_nota    text,
  p_dias    integer default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_fecha date;
begin
  if not public.administra_tienda(p_tienda) then raise exception 'No autorizado'; end if;

  v_fecha := case when p_dias is not null
                  then public.hoy_tienda(p_tienda) + p_dias
                  else p_fecha end;

  update public.clientes
     set proximo_seguimiento = v_fecha,
         seguimiento_nota    = case when v_fecha is null then null
                                    else nullif(btrim(coalesce(p_nota, '')), '') end
   where tienda_id = p_tienda and celular = p_celular;

  if not found then raise exception 'Cliente no encontrado'; end if;
end;
$$;

revoke execute on function public.guardar_seguimiento_cliente(uuid, text, date, text, integer) from public, anon;
grant  execute on function public.guardar_seguimiento_cliente(uuid, text, date, text, integer) to authenticated;
revoke execute on function public.hoy_tienda(uuid) from public, anon;
grant  execute on function public.hoy_tienda(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- clientes_pagina: "a seguir hoy" contra el hoy de la tienda, y devuelve
-- ese hoy para que la pantalla no tenga que adivinarlo.
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
  v_hoy    date;
  v_por    integer := least(greatest(coalesce(p_por, 25), 1), 100);
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
  v_res    jsonb;
begin
  if not public.administra_tienda(p_tienda) then
    raise exception 'No autorizado';
  end if;

  v_hoy := public.hoy_tienda(p_tienda);
  v_q   := nullif(btrim(coalesce(p_q, '')), '');

  -- El celular solo se busca cuando la consulta ES un teléfono (dígitos y
  -- signos de marcado). Si no, "Cliente 5" dejaría el dígito 5 suelto y
  -- casaría con todos los celulares que contengan un 5, o sea con todos.
  v_dig := case
             when v_q ~ '^[0-9+()\s.\-]+$'
             then nullif(regexp_replace(v_q, '\D', '', 'g'), '')
           end;

  with base as (
    select
      c.celular,
      c.nombre,
      c.correo,
      c.ultima_visita,
      c.etiquetas,
      coalesce(btrim(c.nota), '') <> ''         as tiene_nota,
      c.no_molestar,
      c.etapa,
      c.etapa_manual,
      c.proximo_seguimiento,
      c.seguimiento_nota,
      pf.nombre                                 as responsable,
      coalesce(pd.n, 0)                         as pedidos,
      coalesce(pd.pagados, 0)                   as pagados,
      coalesce(pd.pendientes, 0)                as pendientes,
      coalesce(pd.gastado, 0)                   as gastado,
      pd.ultimo                                 as ultimo_pedido,
      coalesce(so.n, 0)                         as solicitudes
    from public.clientes c
    left join public.perfiles pf on pf.id = c.responsable
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
    select * from base
     where case coalesce(p_filtro, 'todos')
             when 'seguir_hoy'  then proximo_seguimiento is not null
                                     and proximo_seguimiento <= v_hoy
             when 'en_pedido'   then etapa = 'en_pedido'
             when 'interesado'  then etapa = 'interesado'
             when 'comprador'   then etapa = 'comprador'
             when 'recurrente'  then etapa = 'recurrente'
             when 'nuevo'       then etapa = 'nuevo'
             when 'dormidos'    then ultima_visita < now() - interval '60 days'
             when 'solicitudes' then solicitudes > 0
             -- alias de la fase A
             when 'compradores' then pagados > 0
             when 'pendientes'  then pendientes > 0
             when 'nuevos'      then pedidos = 0
             else true
           end
  ),
  total as (
    select count(*)::int as n from filtrada
  ),
  pagina as (
    select f.*, row_number() over (
             order by
               case when p_orden = 'gastado'     then gastado end desc nulls last,
               case when p_orden = 'pedidos'     then pedidos end desc nulls last,
               case when p_orden = 'nombre'      then lower(coalesce(nombre, 'zzz')) end asc nulls last,
               case when p_orden = 'seguimiento' then proximo_seguimiento end asc nulls last,
               case when coalesce(p_orden, 'reciente')
                         not in ('gastado','pedidos','nombre','seguimiento')
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
    'hoy',    v_hoy,
    'filas',  coalesce((
      select jsonb_agg(jsonb_build_object(
               'celular',             c.celular,
               'nombre',              c.nombre,
               'correo',              c.correo,
               'ultima_visita',       c.ultima_visita,
               'etiquetas',           to_jsonb(c.etiquetas),
               'tiene_nota',          c.tiene_nota,
               'no_molestar',         c.no_molestar,
               'etapa',               c.etapa,
               'etapa_manual',        c.etapa_manual,
               'proximo_seguimiento', c.proximo_seguimiento,
               'seguimiento_nota',    c.seguimiento_nota,
               'responsable',         c.responsable,
               'pedidos',             c.pedidos,
               'pagados',             c.pagados,
               'pendientes',          c.pendientes,
               'gastado',             c.gastado,
               'ultimo_pedido',       c.ultimo_pedido,
               'solicitudes',         c.solicitudes,
               'intereses',           to_jsonb(c.intereses)
             ) order by c.rn)
        from conintereses c), '[]'::jsonb),
    -- Conteo por segmento: alimenta las pestañas de la bandeja sin traer filas.
    'conteos', (
      select jsonb_build_object(
        'todos',       count(*),
        'seguir_hoy',  count(*) filter (where proximo_seguimiento is not null
                                          and proximo_seguimiento <= v_hoy),
        'en_pedido',   count(*) filter (where etapa = 'en_pedido'),
        'interesado',  count(*) filter (where etapa = 'interesado'),
        'comprador',   count(*) filter (where etapa = 'comprador'),
        'recurrente',  count(*) filter (where etapa = 'recurrente'),
        'nuevo',       count(*) filter (where etapa = 'nuevo'),
        'dormidos',    count(*) filter (where ultima_visita < now() - interval '60 days'),
        'solicitudes', count(*) filter (where solicitudes > 0))
        from base
    )
  ) into v_res;

  return v_res;
end;
$$;

-- ---------------------------------------------------------------------
-- La ficha también necesita el hoy de la tienda para pintar "le toca hoy".
-- Es la de 0034 con un campo más; se reescribe entera porque cada migración
-- ha de poder aplicarse sola.
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

  select c.*, pf.nombre as responsable_nombre
    into v_cli
    from public.clientes c
    left join public.perfiles pf on pf.id = c.responsable
   where c.tienda_id = p_tienda and c.celular = p_celular;
  if not found then return null; end if;

  select jsonb_build_object(
    'hoy', public.hoy_tienda(p_tienda),

    'cliente', jsonb_build_object(
      'celular',             v_cli.celular,
      'nombre',              v_cli.nombre,
      'correo',              v_cli.correo,
      'creado',              v_cli.creado,
      'ultima_visita',       v_cli.ultima_visita,
      'etiquetas',           to_jsonb(v_cli.etiquetas),
      'nota',                v_cli.nota,
      'no_molestar',         v_cli.no_molestar,
      'etapa',               v_cli.etapa,
      'etapa_manual',        v_cli.etapa_manual,
      'proximo_seguimiento', v_cli.proximo_seguimiento,
      'seguimiento_nota',    v_cli.seguimiento_nota,
      'responsable',         v_cli.responsable_nombre,
      'dormido',             v_cli.ultima_visita < now() - interval '60 days'
    ),

    'resumen', (
      select jsonb_build_object(
        'pedidos',       count(*),
        'pagados',       count(*) filter (where estado = 'pagado'),
        'pendientes',    count(*) filter (where estado = 'pendiente'),
        'devueltos',     count(*) filter (where estado = 'devuelto'),
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
    ), '[]'::jsonb),

    -- Todo lo anterior fundido en un solo hilo, que es como se lee una ficha.
    'linea_tiempo', coalesce((
      select jsonb_agg(jsonb_build_object(
               'clase', t.clase, 'titulo', t.titulo, 'detalle', t.detalle,
               'ref', t.ref, 'hora', t.hora) order by t.hora desc)
        from (
          select 'pedido' as clase,
                 'Pedido #' || folio as titulo,
                 estado || ' · ' || total as detalle,
                 id::text as ref, creado as hora
            from public.pedidos
           where tienda_id = p_tienda and cliente_celular = p_celular
          union all
          select 'solicitud', 'Pidió: “' || texto || '”',
                 estado, id::text, creado
            from public.solicitudes_cliente
           where tienda_id = p_tienda and celular = p_celular
          union all
          select 'mensaje', 'Le escribiste', canal || ' · ' || cuerpo, null, hora
            from public.mensajes
           where tienda_id = p_tienda and celular = p_celular
          union all
          select 'chat', 'Chat con el agente',
                 coalesce(tipo_canal, 'chat') || ' · ' || estado, id::text, ultimo_mensaje_en
            from public.agente_conversaciones
           where tienda_id = p_tienda
             and (cliente_celular = p_celular or cliente_externo_id = p_celular)
          union all
          select 'evento', e.tipo, pr.nombre, null, e.hora
            from public.eventos_apartado e
            left join public.productos pr on pr.id = e.producto_id
           where e.tienda_id = p_tienda and e.celular = p_celular
          union all
          select 'evento', e.tipo, pr.nombre, null, e.hora
            from public.eventos_cliente e
            left join public.productos pr on pr.id::text = e.ref_id
           where e.tienda_id = p_tienda and e.celular = p_celular
           order by hora desc limit 60
        ) t
    ), '[]'::jsonb)
  ) into v_ficha;

  return v_ficha;
end;
$$;

revoke execute on function public.clientes_pagina(uuid, text, text, text, integer, integer) from public, anon;
revoke execute on function public.cliente_ficha(uuid, text) from public, anon;
grant  execute on function public.clientes_pagina(uuid, text, text, text, integer, integer) to authenticated;
grant  execute on function public.cliente_ficha(uuid, text) to authenticated;
