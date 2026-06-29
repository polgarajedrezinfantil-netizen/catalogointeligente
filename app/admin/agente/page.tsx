import Link from "next/link";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { embeddingsActivos } from "@/lib/agente/embeddings";
import { SyncEmbeddings } from "./SyncEmbeddings";
import { SelectorTiendaNav } from "../SelectorTiendaNav";

export const dynamic = "force-dynamic";

type Metricas = {
  dias: number;
  conversaciones: {
    total: number; abiertas: number; en_humano: number; cerradas: number;
    por_canal: Record<string, number>;
  };
  atendidas_humano: number;
  resueltas_ia_pct: number;
  uso: { mensajes_agente: number; tokens_in: number; tokens_out: number; costo_estimado_usd: number };
  ventas: {
    links_enviados: number; pagadas: number; canceladas: number;
    ingresos_pagados: number; pipeline_link_enviado: number; aov: number;
    por_canal: Record<string, number>;
  };
  conversion_pct: number;
};

const CANAL: Record<string, string> = {
  simulacion: "🧪 Simulación", whatsapp: "WhatsApp", messenger: "Messenger",
  instagram: "Instagram", desconocido: "Otro",
};

const RANGOS = [7, 30, 90];

function Tarjeta({ titulo, valor, nota, acento }: {
  titulo: string; valor: string; nota?: string; acento?: string;
}) {
  return (
    <div className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-cacao">{titulo}</p>
      <p className={`mt-1 font-titulo text-2xl ${acento ?? "text-texto"}`}>{valor}</p>
      {nota && <p className="mt-0.5 text-xs text-cacao">{nota}</p>}
    </div>
  );
}

export default async function AgenteMetricasPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string; tienda?: string }>;
}) {
  const perfil = await getPerfil();
  const esSuper = perfil?.rol === "superadmin";
  if (!perfil || (!esSuper && !perfil.tienda_id)) {
    return <p className="text-cacao">Esta sección es para administradores de una tienda.</p>;
  }
  const sp = await searchParams;
  const dias = RANGOS.includes(Number(sp.dias)) ? Number(sp.dias) : 30;
  const supabase = await createClient();

  // El superadmin elige qué tienda monitorear; el admin ve la suya.
  const t = esSuper ? (sp.tienda ?? "") : perfil.tienda_id!;
  const tiendas = esSuper
    ? ((await supabase.from("tiendas").select("id, nombre, slug").order("nombre")).data ?? [])
    : [];
  // Slug de la tienda elegida (lo necesita el botón de reindexar para el superadmin).
  const tiendaSlug = esSuper ? tiendas.find((x) => x.id === t)?.slug : undefined;

  if (esSuper && !t) {
    return (
      <div className="max-w-4xl space-y-4">
        <h1 className="font-titulo text-2xl text-durazno">Métricas del agente</h1>
        <p className="text-sm text-cacao">Elige una tienda para ver sus métricas.</p>
        <SelectorTiendaNav tiendas={tiendas} actual="" base="/admin/agente" />
      </div>
    );
  }

  const [{ data, error }, { data: tienda }, { count: nIndexados }, { count: nProductos }] =
    await Promise.all([
      supabase.rpc("agente_metricas", { p_tienda: t, p_dias: dias }),
      supabase.from("tiendas").select("etiqueta_precio").eq("id", t).maybeSingle(),
      supabase
        .from("producto_embeddings")
        .select("producto_id", { count: "exact", head: true })
        .eq("tienda_id", t),
      supabase
        .from("productos")
        .select("id", { count: "exact", head: true })
        .eq("tienda_id", t)
        .eq("oculto", false),
    ]);
  const iaActiva = embeddingsActivos();

  if (error) {
    return <p className="text-cacao">No se pudieron cargar las métricas: {error.message}</p>;
  }
  const m = data as Metricas;
  const sb = tienda?.etiqueta_precio ?? "$";
  const dinero = (n: number) => `${sb}${Number(n).toLocaleString("es-MX")}`;

  const canalesVentas = Object.entries(m.ventas.por_canal).sort((a, b) => b[1] - a[1]);
  const canalesConv = Object.entries(m.conversaciones.por_canal).sort((a, b) => b[1] - a[1]);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <div>
            <h1 className="font-titulo text-2xl text-durazno">Métricas del agente</h1>
            <p className="text-sm text-cacao">
              Resultados del agente de ventas en los últimos {dias} días.
            </p>
          </div>
          {esSuper && <SelectorTiendaNav tiendas={tiendas} actual={t} base="/admin/agente" />}
        </div>
        <div className="flex gap-1">
          {RANGOS.map((r) => (
            <Link
              key={r}
              href={esSuper ? `/admin/agente?tienda=${t}&dias=${r}` : `/admin/agente?dias=${r}`}
              className={`rounded-full px-3 py-1 text-sm font-semibold ${
                r === dias ? "bg-durazno text-white" : "bg-miel/30 text-[#7a5a14] hover:bg-miel/50"
              }`}
            >
              {r}d
            </Link>
          ))}
        </div>
      </div>

      {/* Resultados de venta */}
      <section className="space-y-3">
        <h2 className="font-mano text-lg text-cacao">💰 Ventas atribuidas al agente</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tarjeta titulo="Ingresos cobrados" valor={dinero(m.ventas.ingresos_pagados)}
            nota={`${m.ventas.pagadas} ${m.ventas.pagadas === 1 ? "venta" : "ventas"}`}
            acento="text-verde-mielina" />
          <Tarjeta titulo="Ticket promedio" valor={dinero(m.ventas.aov)} />
          <Tarjeta titulo="Conversión" valor={`${m.conversion_pct}%`}
            nota="ventas / conversaciones" />
          <Tarjeta titulo="Por cobrar" valor={dinero(m.ventas.pipeline_link_enviado)}
            nota={`${m.ventas.links_enviados} links enviados`} acento="text-coral" />
        </div>
        {canalesVentas.length > 0 && (
          <div className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
            <p className="mb-2 text-xs font-semibold uppercase text-cacao">Ingresos por canal</p>
            <div className="space-y-1.5">
              {canalesVentas.map(([canal, monto]) => {
                const max = canalesVentas[0][1] || 1;
                return (
                  <div key={canal} className="flex items-center gap-2 text-sm">
                    <span className="w-28 shrink-0 text-texto">{CANAL[canal] ?? canal}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-crema">
                      <div className="h-full rounded-full bg-verde-mielina"
                        style={{ width: `${Math.max(4, (monto / max) * 100)}%` }} />
                    </div>
                    <span className="w-20 shrink-0 text-right font-semibold text-[#3f5a1c]">{dinero(monto)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Conversaciones */}
      <section className="space-y-3">
        <h2 className="font-mano text-lg text-cacao">💬 Conversaciones</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tarjeta titulo="Total" valor={String(m.conversaciones.total)} />
          <Tarjeta titulo="Resueltas por IA" valor={`${m.resueltas_ia_pct}%`}
            nota={`${m.atendidas_humano} pasaron a humano`} acento="text-verde-mielina" />
          <Tarjeta titulo="Con el agente" valor={String(m.conversaciones.abiertas)} />
          <Tarjeta titulo="En humano" valor={String(m.conversaciones.en_humano)}
            acento="text-durazno" />
        </div>
        {canalesConv.length > 0 && (
          <p className="text-sm text-cacao">
            Por canal:{" "}
            {canalesConv.map(([c, n], i) => (
              <span key={c}>
                {i > 0 && " · "}
                <strong className="text-texto">{CANAL[c] ?? c}</strong> {n}
              </span>
            ))}
          </p>
        )}
      </section>

      {/* Uso / facturación */}
      <section className="space-y-3">
        <h2 className="font-mano text-lg text-cacao">⚙️ Uso del agente (para tu plan)</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Tarjeta titulo="Respuestas del agente" valor={m.uso.mensajes_agente.toLocaleString("es-MX")} />
          <Tarjeta titulo="Tokens procesados"
            valor={(m.uso.tokens_in + m.uso.tokens_out).toLocaleString("es-MX")}
            nota={`${m.uso.tokens_in.toLocaleString("es-MX")} in · ${m.uso.tokens_out.toLocaleString("es-MX")} out`} />
          <Tarjeta titulo="Costo de modelo (estim.)" valor={`$${m.uso.costo_estimado_usd} USD`}
            nota="referencia interna" />
        </div>
      </section>

      {/* Búsqueda inteligente (IA) */}
      <section className="space-y-2">
        <h2 className="font-mano text-lg text-cacao">🔎 Búsqueda inteligente (IA)</h2>
        {iaActiva ? (
          <div className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
            <p className="text-sm text-texto">
              El agente busca por significado en tu catálogo.{" "}
              <strong>{nIndexados ?? 0}</strong> de <strong>{nProductos ?? 0}</strong> productos indexados.
            </p>
            <p className="mb-3 text-xs text-cacao">
              Reindexa cuando agregues o cambies productos para que la IA los encuentre.
            </p>
            <SyncEmbeddings tiendaSlug={tiendaSlug} />
          </div>
        ) : (
          <p className="rounded-[var(--radius-marca)] border border-miel-borde bg-miel/15 p-4 text-sm text-[#7a5a14]">
            Hoy el agente busca por palabras clave (funciona bien para catálogos chicos).
            Para activar la <strong>búsqueda por significado</strong> agrega tu{" "}
            <code className="rounded bg-white px-1">VOYAGE_API_KEY</code> y reindexa el catálogo.
          </p>
        )}
      </section>

      <p className="text-xs text-cacao">
        Las ventas se atribuyen al agente cuando genera el link de pago.{" "}
        <Link href="/admin/conversaciones" className="font-semibold text-durazno underline">
          Ver conversaciones →
        </Link>
      </p>
    </div>
  );
}
