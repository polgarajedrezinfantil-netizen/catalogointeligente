import { NextResponse } from "next/server";
import { getPerfil } from "@/lib/auth";
import { responder } from "@/lib/agente/responder";

// Canal de SIMULACIÓN del agente — probar la venta sin Meta.
//   POST { tienda: "<slug>", cliente?: "<id>", mensaje: "<texto>" }
// Acceso: admin/delegado autenticado, O header x-agente-secret == CRON_SECRET
// (para pruebas automatizadas y, más adelante, integraciones server-to-server).
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const autorizadoPorSecret =
    !!secret && req.headers.get("x-agente-secret") === secret;

  if (!autorizadoPorSecret) {
    const perfil = await getPerfil();
    if (!perfil) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  let body: { tienda?: string; cliente?: string; mensaje?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { tienda, cliente, mensaje } = body;
  if (!tienda || !mensaje?.trim()) {
    return NextResponse.json(
      { error: "Faltan 'tienda' y/o 'mensaje'" },
      { status: 400 },
    );
  }

  try {
    const r = await responder({
      tiendaSlug: tienda,
      canal: "simulacion",
      clienteExternoId: cliente?.trim() || "sim-demo",
      texto: mensaje.trim(),
    });
    return NextResponse.json({
      conversacion_id: r.conversacionId,
      respuesta: r.texto,
      herramientas: r.herramientas,
      usage: r.usage,
    });
  } catch (e) {
    const detalle = e instanceof Error ? e.message : "Error del agente";
    return NextResponse.json({ error: detalle }, { status: 500 });
  }
}
