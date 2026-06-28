import crypto from "crypto";
import {
  resolverCanalATienda,
  mensajeExisteExterno,
} from "@/lib/agente/persistencia";
import { responder } from "@/lib/agente/responder";
import { enviarWhatsApp } from "@/lib/agente/whatsapp";

// Webhook de WhatsApp (Meta Cloud API).
//   GET  -> verificación del webhook (hub.challenge).
//   POST -> mensajes entrantes: valida firma, rutea por phone_number_id a la
//           tienda (agente_canales), corre el agente y responde por la Graph API.
// El agente NO responde si la conversación está en manos de un humano (handoff).
export const runtime = "nodejs";
export const maxDuration = 60;

// --- GET: verificación del webhook ---
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.META_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

/** Valida X-Hub-Signature-256 (HMAC-SHA256 del body crudo con el App Secret). */
function firmaValida(req: Request, rawBody: string): boolean {
  const secret = process.env.META_APP_SECRET;
  // Sin secreto: permitimos en dev, pero en producción fallamos cerrado
  // (un olvido de configuración no debe abrir el webhook).
  if (!secret) return process.env.NODE_ENV !== "production";
  const firma = req.headers.get("x-hub-signature-256");
  if (!firma?.startsWith("sha256=")) return false;
  const esperado =
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperado));
  } catch {
    return false;
  }
}

type WaMessage = {
  id: string;
  from: string;
  type: string;
  text?: { body?: string };
};
type WaContact = { wa_id?: string; profile?: { name?: string } };

// --- POST: mensajes entrantes ---
export async function POST(req: Request) {
  const raw = await req.text();

  if (!firmaValida(req, raw)) {
    return new Response(JSON.stringify({ error: "firma_invalida" }), { status: 401 });
  }

  let body: {
    object?: string;
    entry?: { changes?: { field?: string; value?: Record<string, unknown> }[] }[];
  };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ ok: true, ignorado: "json" }), { status: 200 });
  }

  if (body.object !== "whatsapp_business_account") {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const value = (change.value ?? {}) as {
        metadata?: { phone_number_id?: string };
        contacts?: WaContact[];
        messages?: WaMessage[];
      };

      const phoneNumberId = value.metadata?.phone_number_id;
      const mensajes = value.messages ?? [];
      if (!phoneNumberId || mensajes.length === 0) continue; // p.ej. eventos de 'statuses'

      const tienda = await resolverCanalATienda("whatsapp", phoneNumberId);
      if (!tienda) {
        console.error(`[whatsapp] phone_number_id sin tienda mapeada: ${phoneNumberId}`);
        continue;
      }

      for (const msg of mensajes) {
        try {
          if (await mensajeExisteExterno(msg.id)) continue; // idempotencia

          const nombre =
            value.contacts?.find((c) => c.wa_id === msg.from)?.profile?.name ??
            value.contacts?.[0]?.profile?.name;

          const texto =
            msg.type === "text"
              ? msg.text?.body?.trim() || ""
              : `[El cliente envió un mensaje de tipo "${msg.type}". Por ahora solo puedo leer texto.]`;

          const r = await responder({
            tiendaSlug: tienda.slug,
            canal: "whatsapp",
            clienteExternoId: msg.from,
            texto,
            externalId: msg.id,
            clienteNombre: nombre,
            clienteCelular: msg.from,
          });

          // Solo responde el agente; si está en humano, calla (contesta la bandeja).
          if (r.atendidoPorAgente && r.texto) {
            await enviarWhatsApp(phoneNumberId, msg.from, r.texto);
          }
        } catch (e) {
          console.error("[whatsapp] error procesando mensaje:", e);
          // seguimos con los demás; respondemos 200 igual para no provocar reintentos en bucle
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
