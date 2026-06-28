// Cifrado simétrico para secretos en reposo (tokens de Mercado Pago/WhatsApp por
// tienda). AES-256-GCM con clave derivada de FIELD_ENCRYPTION_KEY. SOLO servidor.
//
// Formato del texto cifrado: base64( iv(12) | authTag(16) | ciphertext ).

import crypto from "crypto";

function clave(): Buffer {
  const secreto = process.env.FIELD_ENCRYPTION_KEY;
  if (!secreto) throw new Error("FIELD_ENCRYPTION_KEY no configurada");
  // Derivamos 32 bytes determinísticos de cualquier longitud de secreto.
  return crypto.createHash("sha256").update(secreto).digest();
}

export function cifrar(texto: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", clave(), iv);
  const ct = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function descifrar(blob: string | null | undefined): string | null {
  if (!blob) return null;
  try {
    const raw = Buffer.from(blob, "base64");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ct = raw.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", clave(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    return null; // clave equivocada o dato corrupto
  }
}
