// Conversions API de Meta (server-side), GRATIS y directo desde nuestro
// servidor. Manda el evento Purchase a Meta cuando un pago se aprueba, para
// cubrir los cobros donde el navegador NO está en nuestra página (checkout
// alojado de MP, pagos asíncronos). Se deduplica con el píxel del navegador
// usando el MISMO event_id (`purchase_<pedido>`).
//
// Se ACTIVA solo si existe META_CAPI_TOKEN (token de la API de conversiones,
// generado en Events Manager → Configuración → API de conversiones) y la
// tienda tiene meta_pixel_id. Sin token es no-op: seguro para desplegar ya.
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { baseUrl } from "@/lib/agente/urls";

const GRAPH = "https://graph.facebook.com/v20.0";

// SHA-256 en minúsculas/sin espacios (requisito de Meta para user_data).
function hash(v: string | null | undefined): string | undefined {
  const s = (v ?? "").trim().toLowerCase();
  if (!s) return undefined;
  return crypto.createHash("sha256").update(s).digest("hex");
}
// Teléfono: solo dígitos, con lada de México si viene de 10 dígitos.
function hashTel(v: string | null | undefined): string | undefined {
  let d = (v ?? "").replace(/\D/g, "");
  if (!d) return undefined;
  if (d.length === 10) d = "52" + d;
  return crypto.createHash("sha256").update(d).digest("hex");
}

type Item = { producto_id: string; nombre: string; precio: number };

export async function enviarPurchaseCAPI(
  pedidoId: string,
  opts: {
    fbp?: string;
    fbc?: string;
    ip?: string;
    userAgent?: string;
    actionSource?: "website" | "other";
  } = {},
): Promise<void> {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return; // no configurado → no-op

  const supabase = createServiceClient();
  const { data: pedido } = await supabase
    .from("pedidos")
    .select("id, tienda_id, items, total, cliente_celular, cliente_correo, cliente_nombre")
    .eq("id", pedidoId)
    .maybeSingle();
  if (!pedido) return;

  const { data: tienda } = await supabase
    .from("tiendas")
    .select("meta_pixel_id, moneda")
    .eq("id", pedido.tienda_id)
    .maybeSingle();
  const pixel = tienda?.meta_pixel_id;
  if (!pixel) return; // la tienda no tiene píxel → nada que enviar

  const items = (pedido.items ?? []) as Item[];
  const contentIds = items.map((i) => i.producto_id).filter(Boolean);

  const user_data: Record<string, unknown> = {};
  const em = hash(pedido.cliente_correo);
  const ph = hashTel(pedido.cliente_celular);
  const fn = hash(pedido.cliente_nombre?.split(" ")[0]);
  if (em) user_data.em = [em];
  if (ph) user_data.ph = [ph];
  if (fn) user_data.fn = [fn];
  if (opts.fbp) user_data.fbp = opts.fbp;
  if (opts.fbc) user_data.fbc = opts.fbc;
  if (opts.ip) user_data.client_ip_address = opts.ip;
  if (opts.userAgent) user_data.client_user_agent = opts.userAgent;

  const evento = {
    event_name: "Purchase",
    event_time: Math.floor(Date.now() / 1000),
    // Mismo id que el píxel del navegador → Meta deduplica (no cuenta doble).
    event_id: `purchase_${pedidoId}`,
    action_source: opts.actionSource ?? "website",
    event_source_url: `${baseUrl()}`,
    user_data,
    custom_data: {
      currency: (tienda?.moneda || "MXN").toUpperCase(),
      value: Number(pedido.total),
      content_type: "product",
      content_ids: contentIds,
      num_items: contentIds.length,
    },
  };

  try {
    const resp = await fetch(`${GRAPH}/${pixel}/events?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [evento] }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      console.error("[capi] Purchase no enviado:", resp.status, t.slice(0, 300));
    }
  } catch (e) {
    console.error("[capi] Purchase error de red:", e);
  }
}

// Lee las cookies _fbp / _fbc del request del navegador (mejoran el match).
export function cookiesFb(req: Request): { fbp?: string; fbc?: string } {
  const raw = req.headers.get("cookie") ?? "";
  const out: { fbp?: string; fbc?: string } = {};
  for (const parte of raw.split(";")) {
    const [k, ...rest] = parte.trim().split("=");
    if (k === "_fbp") out.fbp = rest.join("=");
    if (k === "_fbc") out.fbc = rest.join("=");
  }
  return out;
}
