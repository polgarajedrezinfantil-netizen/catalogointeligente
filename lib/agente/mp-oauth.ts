// Mercado Pago — OAuth / Marketplace por tienda.
// El cliente conecta SU cuenta de MP (un clic). Guardamos sus credenciales
// CIFRADAS por tienda; al cobrar usamos SU token y le descontamos tu comisión
// (marketplace_fee). El dinero entra a la cuenta del cliente.
//
// Requiere registrar TU app de Marketplace en MP y poner en el entorno:
//   MP_CLIENT_ID, MP_CLIENT_SECRET  (credenciales de producción de esa app)

import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { cifrar, descifrar } from "@/lib/cripto";
import { baseUrl } from "./urls";

const AUTH_URL = "https://auth.mercadopago.com.mx/authorization";
const TOKEN_URL = "https://api.mercadopago.com/oauth/token";

export function marketplaceConfigurado(): boolean {
  return !!(process.env.MP_CLIENT_ID && process.env.MP_CLIENT_SECRET);
}

export function redirectUri(): string {
  return `${baseUrl()}/api/agente/mp/oauth/callback`;
}

// --- state firmado (lleva la tienda + anti-CSRF + expiración) ---
function firmar(payload: string): string {
  const key = process.env.FIELD_ENCRYPTION_KEY ?? "";
  return crypto.createHmac("sha256", key).update(payload).digest("hex").slice(0, 32);
}
export function crearState(tiendaId: string): string {
  const payload = `${tiendaId}.${Date.now()}`;
  return Buffer.from(`${payload}.${firmar(payload)}`).toString("base64url");
}
export function leerState(state: string): string | null {
  try {
    const [tiendaId, ts, sig] = Buffer.from(state, "base64url").toString().split(".");
    if (!tiendaId || !ts || !sig) return null;
    if (firmar(`${tiendaId}.${ts}`) !== sig) return null;
    if (Date.now() - Number(ts) > 10 * 60 * 1000) return null; // 10 min
    return tiendaId;
  } catch {
    return null;
  }
}

export function urlAutorizacion(tiendaId: string): string {
  const clientId = process.env.MP_CLIENT_ID;
  if (!clientId) throw new Error("MP_CLIENT_ID no configurado");
  const p = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    platform_id: "mp",
    state: crearState(tiendaId),
    redirect_uri: redirectUri(),
  });
  return `${AUTH_URL}?${p.toString()}`;
}

type TokenResp = {
  access_token?: string;
  refresh_token?: string;
  user_id?: number | string;
  public_key?: string;
  expires_in?: number;
  message?: string;
};

async function pedirToken(body: Record<string, string>): Promise<TokenResp> {
  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: process.env.MP_CLIENT_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      ...body,
    }),
  });
  const data = (await resp.json()) as TokenResp;
  if (!resp.ok) throw new Error(`mp oauth ${resp.status}: ${data.message ?? "error"}`);
  return data;
}

async function guardar(tiendaId: string, d: TokenResp): Promise<void> {
  if (!d.access_token) throw new Error("mp oauth: sin access_token");
  const supabase = createServiceClient();
  await supabase.from("agente_secretos").upsert(
    {
      tienda_id: tiendaId,
      mp_conectado: true,
      mp_user_id: d.user_id != null ? String(d.user_id) : null,
      mp_public_key: d.public_key ?? null,
      mp_access_token: cifrar(d.access_token),
      mp_refresh_token: d.refresh_token ? cifrar(d.refresh_token) : null,
      mp_expira: new Date(Date.now() + (d.expires_in ?? 0) * 1000).toISOString(),
      actualizado: new Date().toISOString(),
    },
    { onConflict: "tienda_id" },
  );
}

/** Intercambia el `code` del callback por credenciales y las guarda. */
export async function conectarTienda(tiendaId: string, code: string): Promise<void> {
  const d = await pedirToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
  });
  await guardar(tiendaId, d);
}

/** Devuelve un access_token válido de la tienda (refresca si expira pronto), o null. */
export async function accessTokenDe(tiendaId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("agente_secretos")
    .select("mp_conectado, mp_access_token, mp_refresh_token, mp_expira")
    .eq("tienda_id", tiendaId)
    .maybeSingle();
  if (!data?.mp_conectado || !data.mp_access_token) return null;

  const expira = data.mp_expira ? new Date(data.mp_expira as string).getTime() : 0;
  const refresh = descifrar(data.mp_refresh_token as string | null);
  if (refresh && expira && expira - Date.now() < 24 * 60 * 60 * 1000) {
    try {
      const d = await pedirToken({ grant_type: "refresh_token", refresh_token: refresh });
      await guardar(tiendaId, d);
      if (d.access_token) return d.access_token;
    } catch {
      /* si falla el refresh, intentamos con el token actual */
    }
  }
  return descifrar(data.mp_access_token as string);
}

/** Estado de conexión + comisión, para el panel. */
export async function estadoMP(
  tiendaId: string,
): Promise<{ conectado: boolean; mp_user_id: string | null; comision_pct: number }> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("agente_secretos")
    .select("mp_conectado, mp_user_id, comision_pct")
    .eq("tienda_id", tiendaId)
    .maybeSingle();
  return {
    conectado: !!data?.mp_conectado,
    mp_user_id: (data?.mp_user_id as string | null) ?? null,
    comision_pct: Number(data?.comision_pct ?? 0),
  };
}

/** Comisión (%) configurada para la tienda. */
export async function comisionPct(tiendaId: string): Promise<number> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("agente_secretos")
    .select("comision_pct")
    .eq("tienda_id", tiendaId)
    .maybeSingle();
  return Number(data?.comision_pct ?? 0);
}

/** Desconecta la cuenta de MP de la tienda. */
export async function desconectarTienda(tiendaId: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("agente_secretos")
    .update({
      mp_conectado: false,
      mp_access_token: null,
      mp_refresh_token: null,
      mp_user_id: null,
      mp_public_key: null,
      mp_expira: null,
      actualizado: new Date().toISOString(),
    })
    .eq("tienda_id", tiendaId);
}
