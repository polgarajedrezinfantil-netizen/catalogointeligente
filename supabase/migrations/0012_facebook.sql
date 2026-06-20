-- Enlace a Facebook para los accesos rápidos del encabezado.
alter table public.tiendas
  add column if not exists facebook_url text;
