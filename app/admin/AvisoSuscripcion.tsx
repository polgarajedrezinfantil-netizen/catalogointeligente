import { estadoSuscripcion } from "@/lib/saas/suscripciones";
import { createServiceClient } from "@/lib/supabase/service";

// Aviso de suscripción en el panel de la tienda: prueba por terminar,
// mensualidad por vencer o vencida. Silencioso para tiendas de cortesía y
// para suscripciones al corriente. Usa el service client porque una tienda
// apagada deja de ser visible para su admin vía RLS (lectura pública solo
// de tiendas activas) y el aviso es justo lo que necesita ver para pagar.
export async function AvisoSuscripcion({ tiendaId }: { tiendaId: string }) {
  const admin = createServiceClient();
  const { data: t } = await admin
    .from("tiendas")
    .select("trial_hasta, suscripcion_hasta, mp_suscripcion_id, mp_init_point, activa")
    .eq("id", tiendaId)
    .maybeSingle();
  if (!t) return null;

  const e = estadoSuscripcion(t);
  if (e.tipo === "cortesia") return null;
  if (e.tipo === "pagada" && (e.diasRestantes ?? 99) > 5) return null;

  const vencida = e.tipo === "vencida";
  const linkPago = t.mp_init_point ? (
    <a
      href={t.mp_init_point}
      target="_blank"
      rel="noopener noreferrer"
      className="font-bold underline"
    >
      Pagar aquí
    </a>
  ) : (
    <span>
      Escribe a{" "}
      <a href="mailto:notificaciones@myelplay.com" className="font-bold underline">
        notificaciones@myelplay.com
      </a>{" "}
      para activar tu pago.
    </span>
  );

  return (
    <div
      className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
        vencida
          ? "border-red-300 bg-red-50 text-red-800"
          : "border-amber-300 bg-amber-50 text-amber-900"
      }`}
    >
      {e.tipo === "trial" && (
        <>
          🕐 Tu <strong>prueba gratis</strong> termina en{" "}
          <strong>{e.diasRestantes} {e.diasRestantes === 1 ? "día" : "días"}</strong>. Para
          seguir sin cortes, activa tu mensualidad. {linkPago}
        </>
      )}
      {e.tipo === "pagada" && (
        <>
          🔔 Tu mensualidad vence en <strong>{e.diasRestantes} días</strong>. Si tu pago es
          automático no tienes que hacer nada.
        </>
      )}
      {vencida && (
        <>
          ⚠️ Tu suscripción <strong>venció</strong>
          {t.activa ? " — tu catálogo se apagará en los próximos días." : " y tu catálogo está apagado."}{" "}
          {linkPago}
        </>
      )}
    </div>
  );
}
