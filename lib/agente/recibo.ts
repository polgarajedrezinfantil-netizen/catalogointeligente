import { createServiceClient } from "@/lib/supabase/service";
import { enviarCorreo, correoConfigurado, escaparHtml } from "@/lib/correo";

type Item = { producto_id: string; nombre: string; precio: number };

// Envía el recibo de pago (con la descripción de cada producto) al correo del
// pagador, con la marca de la tienda. Best-effort: si el correo no está
// configurado o falla, NO rompe el pago (solo loguea).
export async function enviarReciboPago(
  pedidoId: string,
  correo: string | null | undefined,
): Promise<void> {
  if (!correo || !correoConfigurado()) return;

  const supabase = createServiceClient();
  const { data: pedido } = await supabase
    .from("pedidos")
    .select("folio, items, total, tienda_id, cliente_nombre")
    .eq("id", pedidoId)
    .maybeSingle();
  if (!pedido) return;

  const { data: tienda } = await supabase
    .from("tiendas")
    .select("nombre, etiqueta_precio, tema")
    .eq("id", pedido.tienda_id)
    .maybeSingle();

  const marca = String(tienda?.nombre ?? "la tienda").split(" - ")[0];
  const simbolo = (tienda?.etiqueta_precio as string) || "$";
  const tema = (tienda?.tema ?? {}) as Record<string, string>;
  const acento = tema.coral || tema.verde_mielina || "#E1855F";
  const items = (pedido.items ?? []) as Item[];
  const money = (n: number) => `${simbolo}${Number(n).toLocaleString("es-MX")}`;

  // Descripción real de cada producto (si la tiene).
  const ids = items.map((i) => i.producto_id).filter(Boolean);
  const { data: prods } = ids.length
    ? await supabase.from("productos").select("id, descripcion").in("id", ids)
    : { data: [] as { id: string; descripcion: string | null }[] };
  const desc = new Map(
    (prods ?? []).map((p) => [p.id as string, (p.descripcion as string | null) ?? ""]),
  );

  const filas = items
    .map((it) => {
      const d = desc.get(it.producto_id);
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0e9dc;">
          <div style="font-weight:700;color:#4a3f38;">${escaparHtml(it.nombre)}</div>
          ${d ? `<div style="font-size:13px;color:#9c8478;margin-top:2px;">${escaparHtml(d)}</div>` : ""}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #f0e9dc;text-align:right;font-weight:700;color:#4a3f38;white-space:nowrap;">${money(it.precio)}</td>
      </tr>`;
    })
    .join("");

  const hola = pedido.cliente_nombre ? `¡Hola, ${escaparHtml(String(pedido.cliente_nombre))}!` : "¡Hola!";

  const html = `<!doctype html>
<html><body style="margin:0;background:#fcf6e8;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#4a3f38;">
  <div style="max-width:520px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border:1px solid #f0e9dc;border-radius:18px;overflow:hidden;">
      <div style="background:${acento};padding:20px 24px;">
        <div style="color:#fff;font-size:20px;font-weight:800;">${escaparHtml(marca)}</div>
        <div style="color:#ffffffcc;font-size:13px;margin-top:2px;">Recibo de pago · Pedido #${pedido.folio}</div>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 4px;font-size:15px;">${hola}</p>
        <p style="margin:0 0 18px;font-size:14px;color:#9c8478;">Tu pago se recibió correctamente. Aquí está el detalle:</p>
        <table style="width:100%;border-collapse:collapse;">${filas}</table>
        <div style="display:flex;justify-content:space-between;margin-top:16px;padding-top:14px;border-top:2px solid #f0e9dc;">
          <span style="font-weight:800;font-size:16px;">Total pagado</span>
          <span style="font-weight:800;font-size:18px;color:${acento};">${money(Number(pedido.total))}</span>
        </div>
        <div style="margin-top:22px;background:#fcf6e8;border-radius:12px;padding:14px 16px;font-size:13px;color:#7a6a5e;">
          Te contactaremos para coordinar la entrega/recolección de tu pedido. ¡Gracias por tu compra! 🧡
        </div>
      </div>
    </div>
    <p style="text-align:center;font-size:11px;color:#b7a99a;margin:16px 0 0;">
      ${escaparHtml(marca)} · Pago procesado de forma segura por Mercado Pago
    </p>
  </div>
</body></html>`;

  const r = await enviarCorreo({
    to: correo,
    subject: `Recibo de tu pedido #${pedido.folio} · ${marca}`,
    html,
  });
  if (!r.ok) console.error("[recibo] no se envió:", r.error);
}
