import { NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { tokenCobro } from "@/lib/agente/mp-oauth";

// Webhook de Mercado Pago para el cobro del agente.
//   - Valida la firma (x-signature) con MP_WEBHOOK_SECRET.
//   - Consulta el pago real en la API de MP (no confía en el body).
//   - Si está 'approved', cierra el pedido vía pagar_pedido_agente().
// Responde 200 rápido siempre que la firma sea válida (MP reintenta si no).
export const runtime = "nodejs";

/** Verifica x-signature según el esquema HMAC-SHA256 de Mercado Pago. */
function firmaValida(req: Request, dataId: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  // Sin secreto: permitimos en dev, pero en producción fallamos cerrado.
  if (!secret) return process.env.NODE_ENV !== "production";

  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id") ?? "";
  if (!xSignature) return false;

  let ts = "";
  let v1 = "";
  for (const parte of xSignature.split(",")) {
    const [k, v] = parte.split("=");
    if (!k || !v) continue;
    if (k.trim() === "ts") ts = v.trim();
    if (k.trim() === "v1") v1 = v.trim();
  }
  if (!ts || !v1) return false;

  const id = /^[a-zA-Z0-9]+$/.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${id};request-id:${xRequestId};ts:${ts};`;
  const esperado = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(esperado, "hex"),
      Buffer.from(v1, "hex"),
    );
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const url = new URL(req.url);

  let body: { type?: string; topic?: string; data?: { id?: string } } = {};
  try {
    body = await req.json();
  } catch {
    /* MP a veces manda sólo query params */
  }

  const tipo = body.type ?? body.topic ?? url.searchParams.get("type") ?? "";
  const dataId =
    body.data?.id ??
    url.searchParams.get("data.id") ??
    url.searchParams.get("id") ??
    "";

  // Sólo nos interesan notificaciones de pago.
  if (tipo && tipo !== "payment") {
    return NextResponse.json({ ok: true, ignorado: tipo });
  }
  if (!dataId) return NextResponse.json({ ok: true, ignorado: "sin_id" });

  if (!firmaValida(req, String(dataId))) {
    return NextResponse.json({ error: "firma_invalida" }, { status: 401 });
  }

  // Token de la tienda que cobró (vía ?t=) para consultar SU pago; usa la misma
  // resolución que al crear el link (OAuth propio o fallback global autorizado).
  const tiendaId = url.searchParams.get("t");
  const { token } = await tokenCobro(tiendaId);
  if (!token) {
    return NextResponse.json({ error: "cobro_no_configurado" }, { status: 500 });
  }

  // Consulta el pago real en Mercado Pago.
  let pago: { status?: string; external_reference?: string };
  try {
    const resp = await fetch(
      `https://api.mercadopago.com/v1/payments/${dataId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!resp.ok) {
      // 200 para que MP no reintente eternamente por un id que ya no existe.
      return NextResponse.json({ ok: true, pago: resp.status });
    }
    pago = await resp.json();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error_mp" },
      { status: 502 },
    );
  }

  const pedidoId = pago.external_reference;
  if (!pedidoId) return NextResponse.json({ ok: true, ignorado: "sin_referencia" });

  if (pago.status !== "approved") {
    return NextResponse.json({ ok: true, estado: pago.status });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("pagar_pedido_agente", {
    p_pedido: pedidoId,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, resultado: data });
}
