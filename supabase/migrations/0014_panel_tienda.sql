-- =====================================================================
--  Panel del Admin de Tienda: apariencia + contacto + productos pro.
--  (Se agregan todas las columnas del plan; cada fase usa las suyas.)
-- =====================================================================

-- ---- Tienda: marca, textos, redes y preview social ----
alter table public.tiendas
  add column if not exists tiktok_url    text,
  add column if not exists subtitulo     text,
  add column if not exists descripcion   text,
  add column if not exists banner_url    text,
  add column if not exists og_titulo     text,
  add column if not exists og_descripcion text,
  -- Paleta de marca por tienda (se inyecta como variables CSS en runtime).
  add column if not exists tema jsonb not null default jsonb_build_object(
    'crema', '#FCF6E8',
    'miel', '#F4D58D',
    'miel_borde', '#EAD9AE',
    'verde_mielina', '#A6C972',
    'durazno', '#ECA088',
    'sol', '#F4C13E',
    'cacao', '#9C8478',
    'texto', '#5A4A3F',
    'coral', '#E1855F'
  );

-- ---- Productos: ocultar, orden manual y precio de oferta ----
alter table public.productos
  add column if not exists oculto        boolean not null default false,
  add column if not exists orden         integer not null default 0,
  add column if not exists precio_oferta numeric;
