-- ---------------------------------------------------------------------
-- 0028 — Fase 2 del SaaS: suscripciones (mensualidad por tienda).
--
--  * Campos de cobro en `tiendas`:
--      - trial_hasta        → fin de la prueba gratis (14 días en /registro)
--      - suscripcion_hasta  → hasta cuándo está pagada (la extiende el cron
--                             mientras la suscripción MP esté 'authorized',
--                             o el superadmin con "Extender 1 mes")
--      - mp_suscripcion_id  → id del preapproval de MercadoPago Suscripciones
--      - mp_init_point      → link de pago para el dueño de la tienda
--      - precio_mensual     → precio del plan (default $299 MXN)
--      - apagada_por_impago → distingue el apagado del cron del apagado
--                             manual del superadmin (solo el del cron se
--                             revierte solo al volver el pago)
--    Una tienda con TODO en null (trial/suscripción/mp) es de CORTESÍA:
--    el cron no la toca (así queda Mamielina).
--
--  * Candado de columnas: la política `tiendas_admin_edita` (0001) permite
--    al admin de la tienda hacer UPDATE de su fila SIN restricción de
--    columnas — podría moverse su propio `activa`, `plan_clave` o las nuevas
--    columnas de cobro. Este trigger bloquea esos campos para los roles de
--    la API (anon/authenticated) salvo superadmin; el service role y las
--    conexiones directas (migraciones) no se limitan.
-- ---------------------------------------------------------------------

alter table public.tiendas
  add column if not exists trial_hasta        timestamptz,
  add column if not exists suscripcion_hasta  timestamptz,
  add column if not exists mp_suscripcion_id  text,
  add column if not exists mp_init_point      text,
  add column if not exists precio_mensual     numeric not null default 299,
  add column if not exists apagada_por_impago boolean not null default false;

create or replace function public.protege_columnas_cobro()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Solo restringe a los roles de la API; superadmin conserva todo.
  if current_user not in ('authenticated', 'anon') or public.es_superadmin() then
    return new;
  end if;
  if new.activa             is distinct from old.activa
     or new.plan_clave         is distinct from old.plan_clave
     or new.slug               is distinct from old.slug
     or new.trial_hasta        is distinct from old.trial_hasta
     or new.suscripcion_hasta  is distinct from old.suscripcion_hasta
     or new.mp_suscripcion_id  is distinct from old.mp_suscripcion_id
     or new.mp_init_point      is distinct from old.mp_init_point
     or new.precio_mensual     is distinct from old.precio_mensual
     or new.apagada_por_impago is distinct from old.apagada_por_impago
  then
    raise exception 'Columna protegida: solo el operador puede cambiar plan, estado o cobro.';
  end if;
  return new;
end $$;

drop trigger if exists tiendas_protege_cobro on public.tiendas;
create trigger tiendas_protege_cobro
  before update on public.tiendas
  for each row execute function public.protege_columnas_cobro();
