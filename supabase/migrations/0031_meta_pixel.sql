-- 0031: Píxel de Meta por tienda.
-- Guarda el ID del píxel de Facebook/Instagram de cada tienda para el catálogo
-- dinámico: la web dispara PageView, ViewContent y AddToCart con content_ids =
-- id del producto (el mismo del feed), y así Meta puede hacer retargeting.

alter table public.tiendas
  add column if not exists meta_pixel_id text;
