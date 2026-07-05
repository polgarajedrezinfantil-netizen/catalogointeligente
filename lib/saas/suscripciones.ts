// Suscripciones del SaaS (Fase 2): la mensualidad que paga el DUEÑO de cada
// tienda al operador, vía MercadoPago Suscripciones (preapproval) con el
// token del operador (MP_SAAS_ACCESS_TOKEN). No confundir con el MP por
// tienda del agente (lib/agente/mp-oauth.ts), que cobra a las clientas.

import { baseUrl } from "@/lib/agente/urls";

export const TRIAL_DIAS = 14;
export const DIAS_GRACIA = 3;

const API = "https://api.mercadopago.com";

export function saasCobroConfigurado(): boolean {
  return !!process.env.MP_SAAS_ACCESS_TOKEN;
}

function token(): string {
  const t = process.env.MP_SAAS_ACCESS_TOKEN;
  if (!t) throw new Error("MP_SAAS_ACCESS_TOKEN no configurado");
  return t;
}

/**
 * Crea la suscripción mensual (preapproval pendiente) para una tienda y
 * devuelve el link de pago que se le manda al dueño. El cobro es al correo
 * que el dueño use en Mercado Pago.
 *
 * `primerCobro` (opcional): fecha del primer cargo. Sin ella, MP cobra en
 * cuanto el dueño autoriza el link; con ella, el link se puede autorizar
 * desde hoy y MP no cobra nada hasta esa fecha (fin del periodo gratis).
 */
export async function crearSuscripcion(
  tienda: { id: string; nombre: string; precio_mensual: number },
  payerEmail: string,
  primerCobro?: Date | null,
): Promise<{ id: string; init_point: string }> {
  const programado =
    primerCobro && primerCobro.getTime() > Date.now()
      ? { start_date: primerCobro.toISOString() }
      : {};
  const resp = await fetch(`${API}/preapproval`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reason: `MyelPlay Agentes — ${tienda.nombre}`,
      external_reference: tienda.id,
      payer_email: payerEmail,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: Number(tienda.precio_mensual),
        currency_id: "MXN",
        ...programado,
      },
      back_url: `${baseUrl()}/admin`,
      status: "pending",
    }),
  });
  const data = (await resp.json()) as {
    id?: string | number;
    init_point?: string;
    message?: string;
  };
  if (!resp.ok || !data.id || !data.init_point) {
    throw new Error(`mp preapproval ${resp.status}: ${data.message ?? "error"}`);
  }
  return { id: String(data.id), init_point: data.init_point };
}

export type EstadoPreapproval = "pending" | "authorized" | "paused" | "cancelled";

/** Estado actual de la suscripción en MP; null si la consulta falla. */
export async function estadoPreapproval(id: string): Promise<EstadoPreapproval | null> {
  try {
    const resp = await fetch(`${API}/preapproval/${id}`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { status?: string };
    return (data.status as EstadoPreapproval) ?? null;
  } catch {
    return null;
  }
}

// --- Estado de negocio de una tienda (lo usan panel, banner y cron) --------

export type EstadoSuscripcion = {
  tipo: "cortesia" | "trial" | "pagada" | "vencida";
  vence: Date | null;
  diasRestantes: number | null; // negativo = días vencida
};

export function estadoSuscripcion(t: {
  trial_hasta: string | null;
  suscripcion_hasta: string | null;
  mp_suscripcion_id: string | null;
}): EstadoSuscripcion {
  const trial = t.trial_hasta ? new Date(t.trial_hasta) : null;
  const pagada = t.suscripcion_hasta ? new Date(t.suscripcion_hasta) : null;
  if (!trial && !pagada && !t.mp_suscripcion_id) {
    return { tipo: "cortesia", vence: null, diasRestantes: null };
  }
  const vence =
    [trial, pagada]
      .filter((d): d is Date => d != null)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const dias = vence
    ? Math.ceil((vence.getTime() - Date.now()) / 86_400_000)
    : null;
  if (!vence || (dias ?? 0) <= 0) return { tipo: "vencida", vence, diasRestantes: dias };
  if (pagada && pagada.getTime() > Date.now()) {
    return { tipo: "pagada", vence, diasRestantes: dias };
  }
  return { tipo: "trial", vence, diasRestantes: dias };
}
