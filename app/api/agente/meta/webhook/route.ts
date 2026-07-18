import crypto from "crypto";
import {
  resolverCanalATienda,
  mensajeExisteExterno,
} from "@/lib/agente/persistencia";
import { responder } from "@/lib/agente/responder";
import { enviarMeta, descargarImagenUrl } from "@/lib/agente/meta";

// Webhook de Meta para Messenger e Instagram (un solo endpoint).
//   GET  -> verificación del webhook (hub.challenge).
//   POST -> mensajes entrantes: valida firma, rutea por la página/cuenta IG
//           (recipient.id) a la tienda, corre el agente y responde por Send API.
// El agente NO responde si la conversación está en manos de un humano (handoff).
export const runtime = "nodejs";
export const maxDuration = 60;

// --- GET: verificación del webhook (mismo token que WhatsApp) ---
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
  // Sin secreto: permitimos en dev, pero en producción fallamos cerrado.
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

type MetaMessaging = {
  sender?: { id?: string };
  recipient?: { id?: string };
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    attachments?: { type?: string; payload?: { url?: string } }[];
  };
};

// --- POST: mensajes entrantes (Messenger / Instagram) ---
export async function POST(req: Request) {
  const raw = await req.text();

  if (!firmaValida(req, raw)) {
    return new Response(JSON.stringify({ error: "firma_invalida" }), { status: 401 });
  }

  let body: { object?: string; entry?: { messaging?: MetaMessaging[] }[] };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ ok: true, ignorado: "json" }), { status: 200 });
  }

  // 'page' = Messenger; 'instagram' = Instagram. Lo demás se ignora.
  const canal =
    body.object === "instagram" ? "instagram" : body.object === "page" ? "messenger" : null;
  if (!canal) {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  for (const entry of body.entry ?? []) {
    for (const ev of entry.messaging ?? []) {
      try {
        const msg = ev.message;
        // Ignora echoes (mensajes propios) y eventos sin texto (reacciones, etc.).
        if (!msg || msg.is_echo) continue;
        const emisorId = ev.recipient?.id; // página / cuenta IG que recibió
        const clienteId = ev.sender?.id; // PSID / IGSID del cliente
        const texto = msg.text?.trim();
        if (!emisorId || !clienteId || !msg.mid) continue;

        if (await mensajeExisteExterno(msg.mid)) continue; // idempotencia

        const tienda = await resolverCanalATienda(canal, emisorId);
        if (!tienda) {
          console.error(`[${canal}] id sin tienda mapeada: ${emisorId}`);
          continue;
        }

        // Imagen adjunta (visión). Messenger/IG la mandan como URL pública.
        let imagen: { base64: string; mime: string } | undefined;
        const imgUrl = msg.attachments?.find((a) => a.type === "image")?.payload?.url;
        if (imgUrl) imagen = (await descargarImagenUrl(imgUrl)) ?? undefined;

        const cuerpo =
          texto && texto.length
            ? texto
            : imagen
              ? "[El cliente envió una imagen]"
              : `[El cliente envió un adjunto. Por ahora solo puedo leer texto e imágenes.]`;

        const r = await responder({
          tiendaSlug: tienda.slug,
          canal,
          clienteExternoId: clienteId,
          texto: cuerpo,
          imagen,
          externalId: msg.mid,
        });

        if (r.atendidoPorAgente && r.texto) {
          await enviarMeta(emisorId, clienteId, r.texto);
        }
      } catch (e) {
        console.error(`[${canal}] error procesando mensaje:`, e);
        // seguimos; respondemos 200 para no provocar reintentos en bucle.
      }
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
