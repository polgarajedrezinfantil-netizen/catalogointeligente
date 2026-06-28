-- =====================================================================
--  RAG del catálogo — embeddings vectoriales para el agente IA (Fase 1)
--  Permite que el agente busque productos por significado ("algo para una
--  niña de 3 años para una fiesta") y reciba solo los relevantes, en vez de
--  cargar el catálogo entero. Anti-alucinación: la búsqueda filtra por tienda,
--  no oculto y existencia.
--
--  Embeddings: Anthropic NO tiene API de embeddings; se usa Voyage AI
--  (recomendado por Anthropic). Por defecto voyage-3.5 → 1024 dimensiones.
--  Si cambias de modelo/dimensión, ajusta vector(1024) y reindexa.
--
--  Poblado: un job de sync (lee productos.json / la tabla productos, genera
--  embeddings con Voyage y hace upsert aquí) — eso es código de la Fase 1,
--  no esta migración. Esta migración crea el almacén y la función de búsqueda.
-- =====================================================================

create extension if not exists vector;

-- ---------------------------------------------------------------------
-- producto_embeddings: un vector por producto (texto = nombre + descripción
-- + atributos legibles + línea). tienda_id denormalizado para RLS.
-- ---------------------------------------------------------------------
create table if not exists public.producto_embeddings (
  producto_id uuid primary key references public.productos (id) on delete cascade,
  tienda_id   uuid not null references public.tiendas (id) on delete cascade,
  contenido   text not null,                 -- el texto que se embebió (trazabilidad)
  embedding   vector(1024) not null,         -- voyage-3.5; cambia la dimensión si usas otro modelo
  actualizado timestamptz not null default now()
);

create index if not exists idx_prod_emb_tienda on public.producto_embeddings (tienda_id);
-- Índice ANN para búsqueda por similitud coseno.
create index if not exists idx_prod_emb_vector
  on public.producto_embeddings using hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------
-- RLS: superadmin todo; admin/delegado su tienda. El job de sync y el
-- runtime escriben/leen con la service role (salta RLS). Sin lectura pública.
-- ---------------------------------------------------------------------
alter table public.producto_embeddings enable row level security;

drop policy if exists prod_emb_super on public.producto_embeddings;
create policy prod_emb_super on public.producto_embeddings for all
  using (public.es_superadmin()) with check (public.es_superadmin());

drop policy if exists prod_emb_tienda on public.producto_embeddings;
create policy prod_emb_tienda on public.producto_embeddings for all
  using (tienda_id = public.mi_tienda_id())
  with check (tienda_id = public.mi_tienda_id());

-- ---------------------------------------------------------------------
-- buscar_catalogo: búsqueda semántica para el agente.
--   Recibe el embedding de la consulta (generado con Voyage en el runtime),
--   filtra por tienda + no oculto + (opcional) solo disponibles, y devuelve
--   los top-K con campos seguros + distancia. SECURITY DEFINER para poder
--   exponerla por RPC sin abrir las tablas; nunca devuelve costo/datos sensibles.
-- ---------------------------------------------------------------------
create or replace function public.buscar_catalogo(
  p_tienda_id uuid,
  p_embedding vector(1024),
  p_limite int default 5,
  p_solo_disponibles boolean default true
)
returns table (
  producto_id uuid,
  nombre text,
  descripcion text,
  precio numeric,
  existencia int,
  disponible boolean,
  genero text,
  fotos jsonb,
  distancia float
)
language sql stable security definer set search_path = public as $$
  select
    p.id,
    p.nombre,
    p.descripcion,
    coalesce(p.precio_oferta, p.precio) as precio,
    p.cantidad as existencia,
    (p.estado = 'disponible' and p.cantidad > 0) as disponible,
    p.genero,
    p.fotos,
    (e.embedding <=> p_embedding) as distancia
  from public.producto_embeddings e
  join public.productos p on p.id = e.producto_id
  where e.tienda_id = p_tienda_id
    and p.oculto = false
    and (not p_solo_disponibles or (p.estado = 'disponible' and p.cantidad > 0))
  order by e.embedding <=> p_embedding
  limit greatest(1, least(p_limite, 20));
$$;
