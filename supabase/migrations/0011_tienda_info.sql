-- Datos de presentación de la tienda (encabezado estilo perfil de Instagram):
-- bio, ubicación física, horario y enlaces. Editables por el admin más adelante.
alter table public.tiendas
  add column if not exists bio text,
  add column if not exists direccion text,
  add column if not exists horario text,
  add column if not exists maps_url text,
  add column if not exists instagram_url text;
