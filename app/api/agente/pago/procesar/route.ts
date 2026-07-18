import { NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { accessTokenDe, comisionPct } from "@/lib/agente/mp-oauth";
import { baseUrl } from "@/lib/agente/urls";

// Procesa el pago del Payment Brick embebido (página de pago con marca).
// El Brick tokeniza la tarjeta del lado cliente; aquí creamos el pago REAL con
// el access token de la tienda. El monto se toma del PEDIDO (nunca del cliente).
// Si queda 'approved', cerramos el pedido (idempotente; el webhook también lo
// confirma como respaldo).
export const runtime = "nodejs";

type FormData = {
  token?: string;
  payment_method_id?: string;
  issuer_id?: string;
  installments?: number;
  payer?: { email?: string; identification?: { type?: string; number?: string } };
};

export async function POST(req: Request) {
  let body: { pedidoId?: string; formData?: FormData };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: "error", error: "json" }, { status: 400 });
  }

  const pedidoId = String(body?.pedidoId ?? "").trim();
  const fd = body?.formData ?? {};
  if (!/^[0-9a-f-]{36}$/i.test(pedidoId) || !fd.token) {
    return NextResponse.json({ status: "error", error: "faltan_datos" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: pedido } = await supabase
    .from("pedidos")
    .select("id, tienda_id, folio, total, estado")
    .eq("id", pedidoId)
    .maybeSingle();

  if (!pedido) {
    return NextResponse.json({ status: "error", error: "pedido_no_encontrado" }, { status: 404 });
  }
  if (pedido.estado === "pagado") {
    return NextResponse.json({ status: "approved", already: true, folio: pedido.folio });
  }
  if (pedido.estado !== "pendiente") {
    return NextResponse.json({ status: "error", error: "pedido_no_pagable" }, { status: 409 });
  }

  const token = await accessTokenDe(pedido.tienda_id as string);
  if (!token) {
    return NextResponse.json({ status: "error", error: "cobro_no_conectado" }, { status: 500 });
  }

  const total = Number(pedido.total);
  const pct = await comisionPct(pedido.tienda_id as string);
  const fee = pct > 0 ? Math.round((total * pct) / 100) : 0;

  const pago: Record<string, unknown> = {
    transaction_amount: total,
    token: fd.token,
    description: `Pedido #${pedido.folio}`,
    installments: Number(fd.installments) || 1,
    payment_method_id: fd.payment_method_id,
    payer: fd.payer,
    external_reference: pedidoId,
    notification_url: `${baseUrl()}/api/agente/pago/webhook?t=${pedido.tienda_id}`,
    metadata: { pedido_id: pedidoId, tienda_id: pedido.tienda_id },
  };
  if (fd.issuer_id) pago.issuer_id = fd.issuer_id;
  if (fee > 0) pago.application_fee = fee;

  let mp: { status?: string; status_detail?: string; message?: string };
  try {
    const resp = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(pago),
    });
    mp = await resp.json();
    if (!resp.ok) {
      return NextResponse.json(
        { status: "error", error: mp?.message ?? `mp_${resp.status}` },
        { status: 502 },
      );
    }
  } catch (e) {
    console.error("[pago/procesar]", e);
    return NextResponse.json({ status: "error", error: "error_red_mp" }, { status: 502 });
  }

  // Pago aprobado → cerramos el pedido (idempotente). Respaldo: el webhook.
  if (mp.status === "approved") {
    await supabase.rpc("pagar_pedido_agente", { p_pedido: pedidoId });
  }

  return NextResponse.json({
    status: mp.status ?? "unknown",
    status_detail: mp.status_detail,
    folio: pedido.folio,
  });
}
