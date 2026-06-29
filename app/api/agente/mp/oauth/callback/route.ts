import { NextResponse } from "next/server";
import { leerState, conectarTienda } from "@/lib/agente/mp-oauth";
import { baseUrl } from "@/lib/agente/urls";

// Callback de OAuth de Mercado Pago: intercambia el code por credenciales y las
// guarda CIFRADAS para la tienda. MP redirige aquí tras autorizar el cliente.
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";

  const tiendaId = leerState(state);
  const panel = (extra: string) =>
    `${baseUrl()}/admin/agente/alta${tiendaId ? `?tienda=${tiendaId}` : ""}${extra}`;

  if (!tiendaId) return NextResponse.redirect(panel("?mp=estado_invalido"));
  if (!code) return NextResponse.redirect(panel("&mp=sin_code"));

  try {
    await conectarTienda(tiendaId, code);
    return NextResponse.redirect(panel("&mp=ok"));
  } catch (e) {
    console.error("[mp-oauth] callback:", e);
    return NextResponse.redirect(panel("&mp=error"));
  }
}
