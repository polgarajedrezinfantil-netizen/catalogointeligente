-- =====================================================================
--  Fase 4 — Apartado inteligente + tiempo real
--  Regla atómica: "La quiero" solo aparta si el producto sigue Disponible.
--  Lista de espera en orden. Al liberar o vencer el reloj, pasa al siguiente.
-- =====================================================================

create table if not exists public.lista_espera (
  id         uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos (id) on delete cascade,
  tienda_id  uuid not null references public.tiendas (id) on delete cascade,
  celular    text not null,
  posicion   integer not null,
  creado     timestamptz not null default now(),
  unique (producto_id, celular)
);
create index if not exists idx_cola_producto on public.lista_espera (producto_id, posicion);

create table if not exists public.eventos_apartado (
  id          uuid primary key default gen_random_uuid(),
  tienda_id   uuid not null references public.tiendas (id) on delete cascade,
  producto_id uuid references public.productos (id) on delete set null,
  celular     text,
  tipo        text not null,   -- apartar | liberar | vencer | pasar_siguiente | unir_cola | salir_cola | confirmar | vender | agotar
  meta        jsonb not null default '{}'::jsonb,
  hora        timestamptz not null default now()
);
create index if not exists idx_eventos_tienda on public.eventos_apartado (tienda_id, hora desc);

alter table public.lista_espera     enable row level security;
alter table public.eventos_apartado enable row level security;

-- Solo los admins de la tienda leen la cola y la bitácora (privacidad).
drop policy if exists cola_admin on public.lista_espera;
create policy cola_admin on public.lista_espera for select
  using (public.administra_tienda(tienda_id));
drop policy if exists eventos_admin on public.eventos_apartado;
create policy eventos_admin on public.eventos_apartado for select
  using (public.administra_tienda(tienda_id));

-- ---------------------------------------------------------------------
-- Interno: pasa el apartado al siguiente de la cola, o lo libera.
-- ---------------------------------------------------------------------
create or replace function public.avanzar_apartado(p_producto uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_sig   record;
  v_hold  integer;
  v_tienda uuid;
begin
  select tienda_id into v_tienda from public.productos where id = p_producto;
  select hold_horas into v_hold from public.tiendas where id = v_tienda;

  select * into v_sig from public.lista_espera
    where producto_id = p_producto order by posicion asc limit 1;

  if found then
    delete from public.lista_espera where id = v_sig.id;
    -- recorre las posiciones restantes
    update public.lista_espera set posicion = posicion - 1
      where producto_id = p_producto;
    update public.productos
      set estado = 'apartada', holder_celular = v_sig.celular,
          hold_expira = now() + make_interval(hours => v_hold),
          actualizado = now()
      where id = p_producto;
    insert into public.eventos_apartado (tienda_id, producto_id, celular, tipo)
      values (v_tienda, p_producto, v_sig.celular, 'pasar_siguiente');
  else
    update public.productos
      set estado = 'disponible', holder_celular = null, hold_expira = null,
          actualizado = now()
      where id = p_producto;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Público: "La quiero" — apartado atómico o entrada a la cola.
-- Devuelve json: {resultado, posicion?, hold_expira?}
-- ---------------------------------------------------------------------
create or replace function public.apartar_producto(p_producto uuid, p_celular text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tienda uuid;
  v_hold integer;
  v_estado public.estado_producto;
  v_cola_on boolean;
  v_pos integer;
  v_exp timestamptz;
begin
  select tienda_id, estado into v_tienda, v_estado
    from public.productos where id = p_producto;
  if v_tienda is null then return jsonb_build_object('resultado','no_existe'); end if;
  select hold_horas, lista_espera_global into v_hold, v_cola_on
    from public.tiendas where id = v_tienda;

  -- Intento atómico: solo aparta si sigue Disponible.
  v_exp := now() + make_interval(hours => v_hold);
  update public.productos
    set estado = 'apartada', holder_celular = p_celular, hold_expira = v_exp,
        actualizado = now()
    where id = p_producto and estado = 'disponible';

  if found then
    insert into public.eventos_apartado (tienda_id, producto_id, celular, tipo)
      values (v_tienda, p_producto, p_celular, 'apartar');
    return jsonb_build_object('resultado','apartado','hold_expira', v_exp);
  end if;

  -- Ya estaba apartado: ofrecer lista de espera si está activa.
  select estado into v_estado from public.productos where id = p_producto;
  if v_estado in ('apartada','apartada_firme') and v_cola_on then
    -- si ya es el holder, no hace falta cola
    if exists (select 1 from public.productos where id = p_producto and holder_celular = p_celular) then
      return jsonb_build_object('resultado','ya_eres_holder');
    end if;
    insert into public.lista_espera (producto_id, tienda_id, celular, posicion)
      values (p_producto, v_tienda, p_celular,
        coalesce((select max(posicion) from public.lista_espera where producto_id = p_producto), 0) + 1)
    on conflict (producto_id, celular) do nothing;
    select posicion into v_pos from public.lista_espera
      where producto_id = p_producto and celular = p_celular;
    insert into public.eventos_apartado (tienda_id, producto_id, celular, tipo)
      values (v_tienda, p_producto, p_celular, 'unir_cola');
    return jsonb_build_object('resultado','en_cola','posicion', v_pos);
  end if;

  return jsonb_build_object('resultado','no_disponible','estado', v_estado);
end;
$$;

-- ---------------------------------------------------------------------
-- Público: el holder libera ("Ya no la quiero").
-- ---------------------------------------------------------------------
create or replace function public.liberar_producto(p_producto uuid, p_celular text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tienda uuid;
begin
  select tienda_id into v_tienda from public.productos
    where id = p_producto and holder_celular = p_celular;
  if v_tienda is null then return jsonb_build_object('resultado','no_eres_holder'); end if;
  insert into public.eventos_apartado (tienda_id, producto_id, celular, tipo)
    values (v_tienda, p_producto, p_celular, 'liberar');
  perform public.avanzar_apartado(p_producto);
  return jsonb_build_object('resultado','liberado');
end;
$$;

-- ---------------------------------------------------------------------
-- Público: salir de la cola.
-- ---------------------------------------------------------------------
create or replace function public.salir_cola(p_producto uuid, p_celular text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tienda uuid; v_pos integer;
begin
  select tienda_id, posicion into v_tienda, v_pos from public.lista_espera
    where producto_id = p_producto and celular = p_celular;
  if v_tienda is null then return jsonb_build_object('resultado','no_estabas'); end if;
  delete from public.lista_espera where producto_id = p_producto and celular = p_celular;
  update public.lista_espera set posicion = posicion - 1
    where producto_id = p_producto and posicion > v_pos;
  insert into public.eventos_apartado (tienda_id, producto_id, celular, tipo)
    values (v_tienda, p_producto, p_celular, 'salir_cola');
  return jsonb_build_object('resultado','fuera');
end;
$$;

-- ---------------------------------------------------------------------
-- Público: mi posición en la cola de un producto (NULL si no estoy).
-- ---------------------------------------------------------------------
create or replace function public.mi_posicion(p_producto uuid, p_celular text)
returns integer language sql security definer set search_path = public as $$
  select posicion from public.lista_espera
    where producto_id = p_producto and celular = p_celular;
$$;

-- ---------------------------------------------------------------------
-- Barrido de apartados vencidos (lo dispara pg_cron cada minuto).
-- ---------------------------------------------------------------------
create or replace function public.procesar_vencidos()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select id, tienda_id from public.productos
    where estado = 'apartada' and hold_expira is not null and hold_expira < now()
  loop
    insert into public.eventos_apartado (tienda_id, producto_id, tipo)
      values (r.tienda_id, r.id, 'vencer');
    perform public.avanzar_apartado(r.id);
  end loop;
end;
$$;

-- Permisos: el público solo ejecuta las RPCs de cliente.
revoke execute on function public.avanzar_apartado(uuid) from public;
revoke execute on function public.procesar_vencidos() from public;
grant execute on function public.apartar_producto(uuid, text) to anon;
grant execute on function public.liberar_producto(uuid, text) to anon;
grant execute on function public.salir_cola(uuid, text) to anon;
grant execute on function public.mi_posicion(uuid, text) to anon;

-- ---------------------------------------------------------------------
-- Realtime: emitir cambios de productos para sincronizar las pantallas.
-- ---------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.productos;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- pg_cron: vencer apartados cada minuto.
-- ---------------------------------------------------------------------
select cron.unschedule('vencer-apartados')
  where exists (select 1 from cron.job where jobname = 'vencer-apartados');
select cron.schedule('vencer-apartados', '* * * * *', $$ select public.procesar_vencidos(); $$);
