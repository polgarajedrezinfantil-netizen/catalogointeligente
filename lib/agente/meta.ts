// Cliente de envío para Messenger e Instagram (Meta Send API, Graph).
// Manda el mensaje del agente al cliente por la página/cuenta de la tienda.
// Usa un token de página (META_PAGE_TOKEN): el del usuario del sistema con
// permiso pages_messaging / instagram_manage_messages sobre las páginas de los
// clientes (modelo Tech Provider / socio del portafolio comercial).

const VERSION = process.env.META_GRAPH_API_VERSION || "v20.0";

/**
 * Envía un mensaje de texto por Messenger o Instagram.
 * @param emisorId  id de la página (Messenger) o de la cuenta IG (Instagram)
 *                  que recibió el mensaje — es el external_id del canal.
 * @param destinatario  PSID (Messenger) o IGSID (Instagram) del cliente.
 */
export async function enviarMeta(
  emisorId: string,
  destinatario: string,
  texto: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const token = process.env.META_PAGE_TOKEN;
  if (!token) return { ok: false, error: "META_PAGE_TOKEN no configurado" };
  if (!texto?.trim()) return { ok: false, error: "texto vacío" };

  const url = `https://graph.facebook.com/${VERSION}/${emisorId}/messages`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { id: destinatario },
        messaging_type: "RESPONSE",
        message: { text: texto.slice(0, 2000) },
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return { ok: false, error: `graph ${resp.status}: ${data?.error?.message ?? "error"}` };
    }
    return { ok: true, id: data?.message_id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "error_red" };
  }
}
