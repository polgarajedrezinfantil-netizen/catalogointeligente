import { NextResponse } from "next/server";
import { getPerfil } from "@/lib/auth";
import { responder } from "@/lib/agente/responder";
import { obtenerTiendaPorSlug } from "@/lib/agente/persistencia";

// Canal de SIMULACIÓN del agente — probar la venta sin Meta.
//   POST { tienda: "<slug>", cliente?: "<id>", mensaje: "<texto>" }
// Acceso: admin/delegado autenticado SOLO sobre SU tienda (superadmin: cualquiera),
// O header x-agente-secret == CRON_SECRET (server-to-server / crons).
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const autorizadoPorSecret =
    !!secret && req.headers.get("x-agente-secret") === secret;

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

  // Aislamiento: un admin/delegado solo puede simular su propia tienda.
  if (!autorizadoPorSecret) {
    const perfil = await getPerfil();
    if (!perfil) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (perfil.tienda_id) {
      const t = await obtenerTiendaPorSlug(tienda);
      if (!t || t.id !== perfil.tienda_id) {
        return NextResponse.json(
          { error: "Solo puedes simular tu propia tienda" },
          { status: 403 },
        );
      }
    }
    // perfil.tienda_id === null => superadmin: puede simular cualquier tienda
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
      estado: r.estado,
      atendido_por_agente: r.atendidoPorAgente,
      respuesta: r.atendidoPorAgente
        ? r.texto
        : "(En atención humana — el agente no responde; un humano contesta desde la bandeja.)",
      herramientas: r.herramientas,
      usage: r.usage,
    });
  } catch (e) {
    const detalle = e instanceof Error ? e.message : "Error del agente";
    return NextResponse.json({ error: detalle }, { status: 500 });
  }
}
