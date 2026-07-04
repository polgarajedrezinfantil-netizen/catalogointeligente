-- ---------------------------------------------------------------------
-- Endurecimiento (Fase 1): aislar el Storage por tienda.
--
-- Antes, cualquier perfil autenticado podía escribir/actualizar/borrar
-- CUALQUIER objeto del bucket 'fotos' (solo se comprobaba que existiera un
-- perfil). Con multi-tienda eso permite que el admin de la tienda A toque
-- los archivos de la tienda B.
--
-- Todas las subidas usan como prefijo el id de la tienda:
--   <tienda_id>/<archivo>              (components/SubirFotos.tsx)
--   <tienda_id>/importados/<archivo>   (app/admin/productos/ImportarPDF.tsx)
-- así que basta con exigir que la PRIMERA carpeta del path sea la tienda
-- del usuario (o que sea superadmin). La lectura sigue siendo pública para
-- que el catálogo cargue las imágenes sin sesión.
--
-- No afecta objetos existentes: la política se evalúa en cada escritura y
-- las fotos actuales ya viven bajo el prefijo de su tienda. El runtime del
-- agente/seeds usa la service role, que salta RLS.
-- ---------------------------------------------------------------------

-- Lectura pública (sin cambios; se re-declara por idempotencia).
drop policy if exists fotos_lee on storage.objects;
create policy fotos_lee on storage.objects for select
  using (bucket_id = 'fotos');

-- Escritura: la primera carpeta del path debe ser la tienda del usuario.
drop policy if exists fotos_admin_inserta on storage.objects;
create policy fotos_admin_inserta on storage.objects for insert to authenticated
  with check (
    bucket_id = 'fotos'
    and (
      public.es_superadmin()
      or (storage.foldername(name))[1] = public.mi_tienda_id()::text
    )
  );

drop policy if exists fotos_admin_actualiza on storage.objects;
create policy fotos_admin_actualiza on storage.objects for update to authenticated
  using (
    bucket_id = 'fotos'
    and (
      public.es_superadmin()
      or (storage.foldername(name))[1] = public.mi_tienda_id()::text
    )
  )
  with check (
    bucket_id = 'fotos'
    and (
      public.es_superadmin()
      or (storage.foldername(name))[1] = public.mi_tienda_id()::text
    )
  );

drop policy if exists fotos_admin_borra on storage.objects;
create policy fotos_admin_borra on storage.objects for delete to authenticated
  using (
    bucket_id = 'fotos'
    and (
      public.es_superadmin()
      or (storage.foldername(name))[1] = public.mi_tienda_id()::text
    )
  );
