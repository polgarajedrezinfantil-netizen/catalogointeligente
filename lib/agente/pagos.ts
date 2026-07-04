// Cobro del agente (Fase 3): arma el pedido, crea la preferencia de Mercado Pago
// y registra la venta atribuida a la conversación.
//
// Multi-tienda (Marketplace): usa el access_token de MP de CADA tienda (conectado
// por OAuth) y le descuenta tu comisión (marketplace_fee). El dinero entra a la
// cuenta del cliente. Si la tienda aún no conectó su MP, cae al MP_ACCESS_TOKEN
// global (transición) sin comisión.

import { createServiceClient } from "@/lib/supabase/service";
import { baseUrl } from "./urls";
import { tokenCobro, comisionPct } from "./mp-oauth";

const MP_API = "https://api.mercadopago.com/checkout/preferences";

type ItemPedido = { producto_id: string; nombre: string; precio: number };

export type ResultadoCobro =
  | {
      ok: true;
      url: string;
      folio: number;
      total: number;
      pedidoId: string;
      items: ItemPedido[];
      omitidos: number;
    }
  | { ok: false; error: string };

export async function crearLinkPago(params: {
  tiendaId: string;
  tiendaSlug: string;
  moneda: string;
  conversacionId: string;
  canal: string;
  clienteCelular: string;
  clienteNombre?: string;
  productoIds: string[];
  cupon?: string;
}): Promise<ResultadoCobro> {
  // Token de cobro: el de la tienda (OAuth) o, si está autorizada, el global.
  const { token, propio } = await tokenCobro(params.tiendaId);
  if (!token) return { ok: false, error: "cobro_no_conectado" };

  const ids = (params.productoIds ?? [])
    .map((s) => String(s).trim())
    .filter(Boolean);
  if (!ids.length) return { ok: false, error: "sin_productos" };

  const supabase = createServiceClient();

  // 1) Pedido + reserva de prendas (todo del lado servidor).
  const { data: pedido, error: errPedido } = await supabase.rpc(
    "crear_pedido_agente",
    {
      p_tienda: params.tiendaId,
      p_celular: params.clienteCelular,
      p_nombre: params.clienteNombre ?? null,
      p_ids: ids,
      p_cupon: params.cupon ?? null,
    },
  );

  if (errPedido) return { ok: false, error: `pedido: ${errPedido.message}` };
  if (!pedido?.ok) return { ok: false, error: pedido?.error ?? "pedido_fallido" };

  const folio = pedido.folio as number;
  const total = Number(pedido.total);
  const pedidoId = pedido.pedido_id as string;
  const items = (pedido.items ?? []) as ItemPedido[];
  const omitidos = (pedido.omitidos ?? 0) as number;

  // 2) Comisión del marketplace (solo si la tienda usa su propia cuenta).
  const pct = propio ? await comisionPct(params.tiendaId) : 0;
  const fee = pct > 0 ? Math.round((total * pct) / 100) : 0;

  // 3) Preferencia de pago en Mercado Pago (con la cuenta del cliente).
  const base = baseUrl();
  const moneda = params.moneda || "MXN";
  const preferencia: Record<string, unknown> = {
    items: items.map((it) => ({
      id: it.producto_id,
      title: it.nombre,
      quantity: 1,
      unit_price: Number(it.precio),
      currency_id: moneda,
    })),
    external_reference: pedidoId,
    metadata: {
      pedido_id: pedidoId,
      tienda_id: params.tiendaId,
      conversacion_id: params.conversacionId,
      canal: params.canal,
      folio,
    },
    statement_descriptor: params.tiendaSlug.slice(0, 22),
    back_urls: {
      success: `${base}/${params.tiendaSlug}?pago=ok&folio=${folio}`,
      failure: `${base}/${params.tiendaSlug}?pago=error&folio=${folio}`,
      pending: `${base}/${params.tiendaSlug}?pago=pendiente&folio=${folio}`,
    },
    auto_return: "approved",
    // El webhook necesita saber la tienda para usar SU token al consultar el pago.
    notification_url: `${base}/api/agente/pago/webhook?t=${params.tiendaId}`,
  };
  if (fee > 0) preferencia.marketplace_fee = fee;

  let url: string;
  try {
    const resp = await fetch(MP_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `pref-${pedidoId}`,
      },
      body: JSON.stringify(preferencia),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return { ok: false, error: `mercadopago: ${data?.message ?? resp.status}` };
    }
    url = (data.init_point as string) || (data.sandbox_init_point as string);
    if (!url) return { ok: false, error: "mercadopago: sin_link" };
  } catch (e) {
    return {
      ok: false,
      error: `mercadopago: ${e instanceof Error ? e.message : "error_red"}`,
    };
  }

  // 4) Registra la venta atribuida a la conversación.
  await supabase.from("agente_ventas").insert({
    tienda_id: params.tiendaId,
    conversacion_id: params.conversacionId,
    pedido_id: pedidoId,
    canal: params.canal,
    monto: total,
    estado: "link_enviado",
  });

  return { ok: true, url, folio, total, pedidoId, items, omitidos };
}
