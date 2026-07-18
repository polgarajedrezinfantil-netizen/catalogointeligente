import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { publicKeyDe } from "@/lib/agente/mp-oauth";
import { temaStyle } from "@/lib/tema";
import { urlFoto } from "@/lib/fotos";
import type { Tienda } from "@/lib/tipos";
import { BrickPago } from "./BrickPago";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pagar tu pedido",
  robots: { index: false, follow: false }, // páginas de pago no se indexan
};

type Item = { producto_id: string; nombre: string; precio: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PagarPage({
  params,
}: {
  params: Promise<{ tienda: string; pedido: string }>;
}) {
  const { tienda: slug, pedido: pedidoId } = await params;
  if (!UUID.test(pedidoId)) notFound();

  // Página pública (el cliente no está logueado) → service client. El pedido_id
  // es un UUID no adivinable y validamos que sea de ESTA tienda.
  const supabase = createServiceClient();
  const { data: t } = await supabase
    .from("tiendas")
    .select("*")
    .eq("slug", slug)
    .eq("activa", true)
    .maybeSingle();
  if (!t) notFound();
  const tienda = t as Tienda;

  const { data: p } = await supabase
    .from("pedidos")
    .select("id, tienda_id, folio, items, total, estado")
    .eq("id", pedidoId)
    .maybeSingle();
  if (!p || p.tienda_id !== tienda.id) notFound();

  const marca = tienda.nombre.split(" - ")[0];
  const simbolo = tienda.etiqueta_precio || "$";
  const items = (p.items ?? []) as Item[];
  const total = Number(p.total);
  const precio = (n: number) => `${simbolo}${Number(n).toLocaleString("es-MX")}`;
  const estado = p.estado as string;

  const publicKey = estado === "pendiente" ? await publicKeyDe(tienda.id) : null;

  return (
    <div
      style={temaStyle(tienda.tema)}
      className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col bg-crema text-texto"
    >
      {/* Encabezado con la marca de la tienda */}
      <header className="flex items-center gap-2.5 border-b border-miel-borde bg-white/95 px-4 py-3">
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gradient-to-tr from-sol via-durazno to-coral p-[2px]">
          <span className="relative block h-full w-full overflow-hidden rounded-full border-2 border-white bg-crema">
            {tienda.logo_url && (
              <Image src={urlFoto(tienda.logo_url)} alt={marca} fill sizes="36px" className="object-cover" />
            )}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-producto text-base font-bold text-texto">{marca}</p>
          <p className="text-xs text-cacao">Pago seguro · Pedido #{p.folio}</p>
        </div>
      </header>

      <main className="flex-1 space-y-4 px-4 py-5">
        {/* Resumen del pedido */}
        <section className="rounded-2xl border border-miel-borde bg-white p-4">
          <h1 className="mb-3 font-titulo text-lg text-coral">Tu pedido</h1>
          <ul className="divide-y divide-miel-borde/70">
            {items.map((it, i) => (
              <li key={`${it.producto_id}-${i}`} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm text-texto">{it.nombre}</span>
                <span className="shrink-0 text-sm font-semibold text-texto">{precio(it.precio)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-miel-borde pt-3">
            <span className="font-bold text-texto">Total</span>
            <span className="text-lg font-bold text-coral">{precio(total)}</span>
          </div>
        </section>

        {/* Estado del pedido / pago */}
        {estado === "pagado" ? (
          <section className="rounded-2xl border border-verde-mielina/40 bg-verde-mielina/10 p-6 text-center">
            <p className="text-4xl">✅</p>
            <h2 className="mt-2 font-titulo text-xl text-texto">Este pedido ya está pagado</h2>
            <p className="mt-1 text-sm text-cacao">¡Gracias por tu compra! 🧡</p>
          </section>
        ) : estado === "cancelado" ? (
          <section className="rounded-2xl border border-miel-borde bg-white p-6 text-center">
            <p className="text-4xl">🚫</p>
            <h2 className="mt-2 font-titulo text-xl text-texto">Este pedido fue cancelado</h2>
            <p className="mt-1 text-sm text-cacao">
              Escríbenos por WhatsApp si quieres retomarlo.
            </p>
          </section>
        ) : publicKey ? (
          <section className="rounded-2xl border border-miel-borde bg-white p-4">
            <h2 className="mb-3 font-titulo text-lg text-coral">Paga con tarjeta</h2>
            <BrickPago publicKey={publicKey} amount={total} pedidoId={p.id as string} />
          </section>
        ) : (
          <section className="rounded-2xl border border-miel-borde bg-white p-6 text-center text-sm text-cacao">
            El pago en línea aún no está disponible para esta tienda. Escríbenos por WhatsApp
            para completar tu compra.
          </section>
        )}

        <p className="pt-1 text-center text-xs text-cacao">
          Pago protegido por Mercado Pago · Tus datos van cifrados directo a MP.
        </p>
        <div className="text-center">
          <Link href={`/${slug}`} className="text-xs font-semibold text-cacao underline-offset-2 hover:underline">
            ← Volver al catálogo de {marca}
          </Link>
        </div>
      </main>
    </div>
  );
}
