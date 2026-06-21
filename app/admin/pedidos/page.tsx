import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Pedido } from "@/lib/tipos";
import { confirmarPedido } from "./actions";
import { BotonCancelar } from "./BotonCancelar";

const ESTADO: Record<Pedido["estado"], { txt: string; cls: string }> = {
  pendiente: { txt: "Pendiente de pago", cls: "bg-durazno/30 text-[#7a3a26]" },
  pagado: { txt: "Pagado ✓", cls: "bg-verde-mielina/30 text-[#3f5a1c]" },
  cancelado: { txt: "Cancelado", cls: "bg-cacao/20 text-cacao" },
};

function wa(celular: string | null, texto: string) {
  if (!celular) return "#";
  return `https://wa.me/${celular.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;
}

function fecha(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default async function PedidosPage() {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) {
    return <p className="text-cacao">Esta sección es para administradores de una tienda.</p>;
  }
  const t = perfil.tienda_id;
  const supabase = await createClient();

  const [{ data: pedidosData }, { data: tienda }] = await Promise.all([
    supabase.from("pedidos").select("*").eq("tienda_id", t).order("creado", { ascending: false }),
    supabase.from("tiendas").select("etiqueta_precio").eq("id", t).single(),
  ]);
  const pedidos = (pedidosData ?? []) as Pedido[];
  const simbolo = tienda?.etiqueta_precio ?? "$";
  const pendientes = pedidos.filter((p) => p.estado === "pendiente").length;

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="font-titulo text-2xl text-durazno">Pedidos</h1>
        <p className="text-sm text-cacao">
          Cuando un cliente toca <strong>“Generar pedido”</strong> aparece aquí. Coordina el
          pago por WhatsApp y, al recibirlo, toca <strong>Confirmar pago</strong> para marcar
          las prendas como vendidas.
        </p>
      </div>

      {pendientes > 0 && (
        <p className="rounded-xl bg-durazno/15 p-3 text-sm font-semibold text-[#7a3a26]">
          Tienes {pendientes} {pendientes === 1 ? "pedido pendiente" : "pedidos pendientes"} de pago.
        </p>
      )}

      {pedidos.length === 0 && (
        <p className="rounded-xl bg-miel/30 p-4 text-sm text-[#7a5a14]">
          Aún no hay pedidos. Cuando una clienta genere uno desde su carrito, lo verás aquí.
        </p>
      )}

      <div className="space-y-3">
        {pedidos.map((p) => {
          const est = ESTADO[p.estado];
          return (
            <div key={p.id} className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-titulo text-lg text-coral">Pedido #{p.folio}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${est.cls}`}>{est.txt}</span>
                <span className="ml-auto text-xs text-cacao">{fecha(p.creado)}</span>
              </div>

              {/* Cliente */}
              <p className="mt-1 text-sm text-texto">
                <strong>{p.cliente_nombre || "Cliente"}</strong>
                {p.cliente_celular && (
                  <>
                    {" · "}
                    <a
                      href={wa(p.cliente_celular, `¡Hola! Sobre tu pedido #${p.folio} en la tienda 🍯`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-verde-mielina underline"
                    >
                      {p.cliente_celular}
                    </a>
                  </>
                )}
                {p.cliente_correo && <span className="text-cacao"> · {p.cliente_correo}</span>}
              </p>

              {/* Prendas */}
              <ul className="mt-2 divide-y divide-miel-borde rounded-xl bg-crema/60 px-3">
                {p.items.map((it, i) => (
                  <li key={i} className="flex justify-between py-1.5 text-sm">
                    <span className="text-texto">{it.nombre}</span>
                    <span className="font-semibold text-[#7a5414]">{simbolo}{it.precio}</span>
                  </li>
                ))}
              </ul>

              {/* Totales */}
              <div className="mt-2 text-right text-sm">
                {p.descuento > 0 && (
                  <p className="text-cacao">
                    Subtotal {simbolo}{p.subtotal} · Cupón {p.cupon} −{simbolo}{p.descuento}
                  </p>
                )}
                <p className="font-producto text-lg font-bold text-texto">
                  Total: {simbolo}{p.total}
                </p>
              </div>

              {/* Acciones */}
              {p.estado === "pendiente" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={confirmarPedido}>
                    <input type="hidden" name="pedido_id" value={p.id} />
                    <button className="rounded-full bg-verde-mielina px-4 py-2 text-sm font-bold text-white">
                      ✓ Confirmar pago (vender)
                    </button>
                  </form>
                  <BotonCancelar pedidoId={p.id} folio={p.folio} />
                </div>
              )}
              {p.estado === "pagado" && p.confirmado_en && (
                <p className="mt-2 text-xs text-[#3f5a1c]">Pagado el {fecha(p.confirmado_en)}.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
