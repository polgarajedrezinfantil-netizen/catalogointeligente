-- =====================================================================
--  Hardening: restringe la RPC buscar_catalogo al service_role.
--
--  Por defecto Postgres concede EXECUTE a PUBLIC en funciones nuevas, y
--  PostgREST expone /rpc/buscar_catalogo. Como la función es SECURITY DEFINER
--  y NO valida administra_tienda (confía en el p_tienda_id que reciba), quedaba
--  invocable por anon/authenticated → podían leer catálogo (nombre/precio/
--  existencia/fotos) de cualquier tienda pasando su uuid.
--
--  El runtime del agente la llama con la SERVICE ROLE (que sí filtra por tienda
--  en el código). Por eso: revocamos a public/anon/authenticated y concedemos
--  solo a service_role. (No añadimos administra_tienda() porque el service role
--  no tiene auth.uid() y el check fallaría.)
-- =====================================================================

revoke all on function public.buscar_catalogo(uuid, vector, integer, boolean)
  from public, anon, authenticated;

grant execute on function public.buscar_catalogo(uuid, vector, integer, boolean)
  to service_role;
