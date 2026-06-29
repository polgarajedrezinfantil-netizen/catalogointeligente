-- =====================================================================
--  Comisión del marketplace por tienda (tu renta automática por venta).
--  Vive en agente_secretos (solo superadmin / service role) para que el
--  admin de la tienda NO pueda cambiar su propia comisión.
-- =====================================================================
alter table public.agente_secretos
  add column if not exists comision_pct numeric not null default 0;
