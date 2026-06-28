// Cliente de envío de WhatsApp (Graph API de Meta — WhatsApp Cloud API).
// Manda el mensaje del agente al cliente. El cobro entra a la cuenta del cliente;
// aquí solo se envía texto por la cuenta de WhatsApp de la tienda.

const VERSION = process.env.META_GRAPH_API_VERSION || "v20.0";

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
