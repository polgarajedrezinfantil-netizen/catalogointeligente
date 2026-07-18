-- ---------------------------------------------------------------------
-- 0029_landing_tienda: landing de bienvenida por tienda (antes del catálogo).
--
-- Con landing_activa = true, <tienda>.myelplay.com muestra una landing
-- (hero + productos destacados + contacto) y el catálogo queda a un clic.
-- Con false (default) el subdominio sigue yendo directo al catálogo, como hoy.
-- Es un interruptor por tienda: cada cliente la enciende cuando quiera.
-- ---------------------------------------------------------------------

alter table public.tiendas
  add column if not exists landing_activa boolean not null default false;
