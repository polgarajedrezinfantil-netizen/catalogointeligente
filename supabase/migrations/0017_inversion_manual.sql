-- =====================================================================
--  Inversión manual: permite que la tienda fije a mano cuánto invirtió en
--  su inventario (si los costos por producto no están capturados o quiere
--  reflejar su inversión real). NULL = usar el cálculo automático
--  (Σ costo × piezas de lo existente).
-- =====================================================================

alter table public.tiendas
  add column if not exists inversion_manual numeric;
