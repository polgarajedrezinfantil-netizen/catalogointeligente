import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  DIAS_GRACIA,
  estadoPreapproval,
  saasCobroConfigurado,
} from "@/lib/saas/suscripciones";

// Barrido diario de suscripciones (Fase 2).
//   - Tienda de cortesía (trial/suscripción/mp todo null) → no se toca.
//   - Suscripción MP 'authorized' → extiende suscripcion_hasta (+32 días) y
//     reenciende la tienda si el propio cron la había apagado por impago.
//   - Vencida (trial o pago) + días de gracia → apaga `activa` y lo marca
//     con apagada_por_impago (el apagado manual del superadmin no se revierte).
// Acceso: Vercel Cron manda "Authorization: Bearer CRON_SECRET" automático;
// también se acepta x-agente-secret para dispararlo a mano.
export const runtime = "nodejs";
export const maxDuration = 60;

const DIA_MS = 86_400_000;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const autorizado =
    !!secret &&
    (req.headers.get("authorization") === `Bearer ${secret}` ||
      req.headers.get("x-agente-secret") === secret);
  if (!autorizado) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: tiendas, error } = await supabase
    .from("tiendas")
    .select(
      "id, nombre, activa, trial_hasta, suscripcion_hasta, mp_suscripcion_id, apagada_por_impago",
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ahora = Date.now();
  const resumen: Array<{ tienda: string; accion: string }> = [];

  for (const t of tiendas ?? []) {
    const esGestionada = t.trial_hasta || t.suscripcion_hasta || t.mp_suscripcion_id;
    if (!esGestionada) continue; // cortesía: fuera del cobro

    const cambios: Record<string, unknown> = {};
    let suscripcionHasta = t.suscripcion_hasta
      ? new Date(t.suscripcion_hasta).getTime()
      : null;

    // 1) Si tiene suscripción MP y sigue autorizada, corre la fecha pagada.
    if (t.mp_suscripcion_id && saasCobroConfigurado()) {
      const estado = await estadoPreapproval(t.mp_suscripcion_id);
      if (estado === "authorized") {
        const nuevoHasta = ahora + 32 * DIA_MS;
        if (!suscripcionHasta || suscripcionHasta < nuevoHasta) {
          suscripcionHasta = nuevoHasta;
          cambios.suscripcion_hasta = new Date(nuevoHasta).toISOString();
        }
        if (t.apagada_por_impago) {
          cambios.activa = true;
          cambios.apagada_por_impago = false;
          resumen.push({ tienda: t.nombre, accion: "reencendida (pago al corriente)" });
        }
      }
    }

    // 2) Vencida más allá de la gracia → apagar (solo si sigue encendida).
    const trialHasta = t.trial_hasta ? new Date(t.trial_hasta).getTime() : null;
    const vence = Math.max(trialHasta ?? 0, suscripcionHasta ?? 0) || null;
    const limite = vence != null ? vence + DIAS_GRACIA * DIA_MS : null;
    if (limite != null && ahora > limite && t.activa && cambios.activa !== true) {
      cambios.activa = false;
      cambios.apagada_por_impago = true;
      resumen.push({ tienda: t.nombre, accion: "apagada (vencida + gracia)" });
    }

    if (Object.keys(cambios).length > 0) {
      const { error: eUpd } = await supabase
        .from("tiendas")
        .update(cambios)
        .eq("id", t.id);
      if (eUpd) resumen.push({ tienda: t.nombre, accion: `ERROR: ${eUpd.message}` });
    }
  }

  return NextResponse.json({
    ok: true,
    revisadas: (tiendas ?? []).length,
    cambios: resumen,
  });
}
