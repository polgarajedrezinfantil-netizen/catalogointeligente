import { NextResponse } from "next/server";
import { getPerfil } from "@/lib/auth";
import { urlAutorizacion, marketplaceConfigurado } from "@/lib/agente/mp-oauth";
import { baseUrl } from "@/lib/agente/urls";

// Inicia la conexión OAuth de Mercado Pago para una tienda.
//   GET /api/agente/mp/oauth/iniciar?tienda=<tienda_id>
// Solo superadmin (cualquier tienda) o el admin/delegado dueño de esa tienda.
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tiendaId = url.searchParams.get("tienda") ?? "";
  const panel = `${baseUrl()}/admin/agente/alta?tienda=${tiendaId}`;

  const perfil = await getPerfil();
  if (!perfil) return NextResponse.redirect(`${baseUrl()}/admin/login`);

  const esSuper = perfil.rol === "superadmin";
  if (!tiendaId || (!esSuper && perfil.tienda_id !== tiendaId)) {
    return NextResponse.redirect(`${panel}&mp=denegado`);
  }
  if (!marketplaceConfigurado()) {
    return NextResponse.redirect(`${panel}&mp=sin_app`);
  }

  return NextResponse.redirect(urlAutorizacion(tiendaId));
}
