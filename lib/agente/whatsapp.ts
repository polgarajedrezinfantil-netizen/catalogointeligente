// Cliente de envío de WhatsApp (Graph API de Meta — WhatsApp Cloud API).
// Manda el mensaje del agente al cliente. El cobro entra a la cuenta del cliente;
// aquí solo se envía texto por la cuenta de WhatsApp de la tienda.

const VERSION = process.env.META_GRAPH_API_VERSION || "v20.0";

const MIMES_SOPORTADOS = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/**
 * Descarga una imagen que el cliente mandó por WhatsApp y la devuelve en base64
 * (para pasársela a Claude como visión). Los media de Meta son temporales, así
 * que solo sirve en el turno en que llega. Devuelve null si falla o no es imagen.
 */
export async function descargarMediaWhatsApp(
  mediaId: string,
): Promise<{ base64: string; mime: string } | null> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token || !mediaId) return null;
  try {
    // 1) metadata → URL temporal + mime
    const meta = await fetch(`https://graph.facebook.com/${VERSION}/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!meta.ok) return null;
    const info = (await meta.json()) as { url?: string; mime_type?: string };
    if (!info.url) return null;
    const mime = (info.mime_type || "image/jpeg").split(";")[0].trim();
    if (!MIMES_SOPORTADOS.includes(mime)) return null;
    // 2) binario (mismo token)
    const bin = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!bin.ok) return null;
    const buf = Buffer.from(await bin.arrayBuffer());
    if (buf.length > 5 * 1024 * 1024) return null; // límite sano (~5 MB)
    return { base64: buf.toString("base64"), mime };
  } catch {
    return null;
  }
}

/** Envía un mensaje de texto por WhatsApp. Devuelve {ok, id?|error}. */
export async function enviarWhatsApp(
  phoneNumberId: string,
  para: string,
  texto: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) return { ok: false, error: "WHATSAPP_TOKEN no configurado" };
  if (!texto?.trim()) return { ok: false, error: "texto vacío" };

  const url = `https://graph.facebook.com/${VERSION}/${phoneNumberId}/messages`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: para,
        type: "text",
        text: { preview_url: true, body: texto.slice(0, 4096) },
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return { ok: false, error: `graph ${resp.status}: ${data?.error?.message ?? "error"}` };
    }
    return { ok: true, id: data?.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "error_red" };
  }
}
