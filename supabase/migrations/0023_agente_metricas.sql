-- =====================================================================
--  AGENTE IA DE VENTAS — Fase 5: métricas del panel del cliente
--
--  Una sola función que devuelve TODO el tablero de una tienda en jsonb:
--  conversaciones (por canal/estado), % resuelto por IA, ventas e ingresos
--  atribuidos al agente (por canal), conversión, uso de tokens (para facturar
--  la renta) y la serie diaria de los últimos N días.
--
--  SECURITY DEFINER pero con verificación explícita de permiso
--  (administra_tienda) y filtrando SIEMPRE por p_tienda — mismo patrón que
--  confirmar_pedido/cancelar_pedido. El panel la llama con el cliente de sesión.
-- =====================================================================

create or replace function public.agente_metricas(p_tienda uuid, p_dias int default 30)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_desde      timestamptz := now() - make_interval(days => greatest(p_dias, 1));
  v_conv_total int; v_abiertas int; v_en_humano int; v_cerradas int; v_humano int;
  v_por_canal_conv  jsonb;
  v_msg_agente int; v_tin bigint; v_tout bigint;
  v_links int; v_pagadas int; v_canceladas int;
  v_ingresos numeric; v_pipeline numeric; v_aov numeric;
  v_por_canal_ventas jsonb;
  v_serie jsonb;
begin
  if not public.administra_tienda(p_tienda) then
    raise exception 'No autorizado';
  end if;

  -- Conversaciones creadas en la ventana
  select count(*),
         count(*) filter (where estado = 'abierta'),
         count(*) filter (where estado = 'en_humano'),
         count(*) filter (where estado = 'cerrada')
    into v_conv_total, v_abiertas, v_en_humano, v_cerradas
    from public.agente_conversaciones
   where tienda_id = p_tienda and creado >= v_desde;

  -- Atendidas por humano: en_humano ahora, o con algún mensaje del equipo
  select count(distinct c.id) into v_humano
    from public.agente_conversaciones c
   where c.tienda_id = p_tienda and c.creado >= v_desde
     and (c.estado = 'en_humano'
          or exists (select 1 from public.agente_mensajes m
                      where m.conversacion_id = c.id and m.rol = 'humano'));

  select coalesce(jsonb_object_agg(canal, n), '{}'::jsonb) into v_por_canal_conv
    from (select coalesce(tipo_canal, 'desconocido') canal, count(*) n
            from public.agente_conversaciones
           where tienda_id = p_tienda and creado >= v_desde
           group by 1) s;

  -- Uso (tokens) de los mensajes generados por el agente
  select count(*),
         coalesce(sum((meta->'usage'->>'input')::bigint), 0),
         coalesce(sum((meta->'usage'->>'output')::bigint), 0)
    into v_msg_agente, v_tin, v_tout
    from public.agente_mensajes
   where tienda_id = p_tienda and rol = 'agente' and creado >= v_desde;

  -- Ventas atribuidas al agente
  select count(*) filter (where estado in ('link_enviado','pagado','cancelado')),
         count(*) filter (where estado = 'pagado'),
         count(*) filter (where estado = 'cancelado'),
         coalesce(sum(monto) filter (where estado = 'pagado'), 0),
         coalesce(sum(monto) filter (where estado = 'link_enviado'), 0)
    into v_links, v_pagadas, v_canceladas, v_ingresos, v_pipeline
    from public.agente_ventas
   where tienda_id = p_tienda and creado >= v_desde;

  v_aov := case when v_pagadas > 0 then round(v_ingresos / v_pagadas, 2) else 0 end;

  select coalesce(jsonb_object_agg(canal, monto), '{}'::jsonb) into v_por_canal_ventas
    from (select coalesce(canal, 'desconocido') canal, coalesce(sum(monto), 0) monto
            from public.agente_ventas
           where tienda_id = p_tienda and estado = 'pagado' and creado >= v_desde
           group by 1) s;

  -- Serie diaria (conversaciones + ventas pagadas + ingresos)
  select coalesce(jsonb_agg(jsonb_build_object(
            'dia', d::date,
            'conversaciones', coalesce(cc.n, 0),
            'ventas', coalesce(vv.n, 0),
            'ingresos', coalesce(vv.monto, 0)) order by d), '[]'::jsonb)
    into v_serie
    from generate_series(v_desde::date, now()::date, interval '1 day') d
    left join (select creado::date dia, count(*) n
                 from public.agente_conversaciones
                where tienda_id = p_tienda and creado >= v_desde group by 1) cc on cc.dia = d::date
    left join (select creado::date dia, count(*) n, sum(monto) monto
                 from public.agente_ventas
                where tienda_id = p_tienda and estado = 'pagado' and creado >= v_desde group by 1) vv on vv.dia = d::date;

  return jsonb_build_object(
    'dias', p_dias,
    'conversaciones', jsonb_build_object(
        'total', v_conv_total, 'abiertas', v_abiertas,
        'en_humano', v_en_humano, 'cerradas', v_cerradas,
        'por_canal', v_por_canal_conv),
    'atendidas_humano', v_humano,
    'resueltas_ia_pct', case when v_conv_total > 0
        then round(100.0 * (v_conv_total - v_humano) / v_conv_total, 1) else 0 end,
    'uso', jsonb_build_object(
        'mensajes_agente', v_msg_agente,
        'tokens_in', v_tin, 'tokens_out', v_tout,
        'costo_estimado_usd', round((v_tin / 1000000.0 * 5) + (v_tout / 1000000.0 * 25), 4)),
    'ventas', jsonb_build_object(
        'links_enviados', v_links, 'pagadas', v_pagadas, 'canceladas', v_canceladas,
        'ingresos_pagados', v_ingresos, 'pipeline_link_enviado', v_pipeline,
        'aov', v_aov, 'por_canal', v_por_canal_ventas),
    'conversion_pct', case when v_conv_total > 0
        then round(100.0 * v_pagadas / v_conv_total, 1) else 0 end
  );
end;
$$;

grant execute on function public.agente_metricas(uuid, int) to authenticated;
