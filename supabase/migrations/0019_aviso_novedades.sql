-- =====================================================================
--  Banner de novedades + cupón visible en el catálogo.
--  La tienda escribe un aviso (promo/novedad) y, opcionalmente, destaca un
--  cupón para que el cliente lo vea y lo copie.
-- =====================================================================

alter table public.tiendas
  add column if not exists aviso_texto  text,
  add column if not exists aviso_cupon  text,
  add column if not exists aviso_activo boolean not null default false;
