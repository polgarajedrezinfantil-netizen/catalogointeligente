-- =====================================================================
--  Datos de pago de la tienda (solución directa mientras no hay pasarela).
--  Texto libre: CLABE/transferencia, link de cobro (Mercado Pago/PayPal),
--  o instrucciones CoDi. Se adjunta al pedido por WhatsApp.
-- =====================================================================
alter table public.tiendas add column if not exists datos_pago text;
