-- =====================================================================
--  Sección "Mami": productos solo para mamás (género adicional).
--  Amplía el check de productos.genero para aceptar 'mami'.
-- =====================================================================

alter table public.productos drop constraint if exists productos_genero_chk;

do $$ begin
  alter table public.productos
    add constraint productos_genero_chk
    check (genero is null or genero in ('nino', 'nina', 'unisex', 'mami'));
exception when duplicate_object then null; end $$;
