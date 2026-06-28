import { NextResponse } from "next/server";
import { getPerfil } from "@/lib/auth";
import { obtenerTiendaPorSlug } from "@/lib/agente/persistencia";
import { sincronizarEmbeddings } from "@/lib/agente/sync-embeddings";
import { embeddingsActivos } from "@/lib/agente/embeddings";

// Reindexa el catálogo de una tienda para la búsqueda vectorial del agente.
//   POST { tienda?: "<slug>" }
// Acceso: admin/delegado autenticado (su tienda), O header x-agente-secret
// == CRON_SECRET (entonces 'tienda' es obligatorio: para crons/superadmin).
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!embeddingsActivos()) {
    return NextResponse.json(
      { error: "VOYAGE_API_KEY no configurada: la búsqueda vectorial está apagada." },
      { status: 400 },
    );
  }

  const secret = process.env.CRON_SECRET;
  const porSecret = !!secret && req.headers.get("x-agente-secret") === secret;

  let body: { tienda?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* sin body */
  }

  let tiendaId: string | null = null;

  if (porSecret) {
    if (!body.tienda) {
      return NextResponse.json({ error: "Falta 'tienda' (slug)" }, { status: 400 });
    }
    const tienda = await obtenerTiendaPorSlug(body.tienda);
    if (!tienda) return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });
    tiendaId = tienda.id;
  } else {
    const perfil = await getPerfil();
    if (!perfil) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (perfil.tienda_id) {
      tiendaId = perfil.tienda_id;
    } else if (body.tienda) {
      // superadmin: puede indexar cualquier tienda por slug
      const tienda = await obtenerTiendaPorSlug(body.tienda);
      if (!tienda) return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });
      tiendaId = tienda.id;
    } else {
      return NextResponse.json({ error: "Falta 'tienda' (slug)" }, { status: 400 });
    }
  }

  try {
    const resultado = await sincronizarEmbeddings(tiendaId);
    return NextResponse.json({ ok: true, ...resultado });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al indexar" },
      { status: 500 },
    );
  }
}
