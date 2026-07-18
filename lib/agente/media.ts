// Media entrante del agente: persiste la imagen del cliente en Storage (para
// verla en la bandeja) y detecta si es un comprobante de pago (para ofrecer
// Aprobar/Rechazar al humano). Ambas son best-effort: si fallan, el mensaje se
// guarda igual (solo sin imagen o sin marca de comprobante).

import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/service";
import { urlFoto, BUCKET } from "@/lib/fotos";

type Imagen = { base64: string; mime: string };
type MediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Sube la imagen al bucket público `fotos` bajo agente/<conv>/<ts>.<ext>. */
export async function subirImagenAgente(
  imagen: Imagen,
  conversacionId: string,
): Promise<string | null> {
  try {
    const ext = EXT[imagen.mime] ?? "jpg";
    const path = `agente/${conversacionId}/${Date.now()}.${ext}`;
    const buf = Buffer.from(imagen.base64, "base64");
    const supabase = createServiceClient();
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, buf, { contentType: imagen.mime, upsert: false });
    if (error) throw error;
    return urlFoto(path); // URL pública
  } catch (e) {
    console.error("[agente] no se pudo guardar la imagen:", e);
    return null;
  }
}

/** ¿La imagen es un comprobante/recibo de pago o transferencia? (Haiku, barato). */
export async function esComprobantePago(imagen: Imagen): Promise<boolean> {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 5,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: imagen.mime as MediaType, data: imagen.base64 },
            },
            {
              type: "text",
              text: "¿Esta imagen es un comprobante o recibo de pago / transferencia bancaria (voucher)? Responde solo con 'si' o 'no'.",
            },
          ],
        },
      ],
    });
    const t = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .toLowerCase();
    return /\bs[ií]\b/.test(t);
  } catch (e) {
    console.error("[agente] clasificación de comprobante falló:", e);
    return false;
  }
}
