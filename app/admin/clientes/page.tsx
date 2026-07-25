import Link from "next/link";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FichaCliente } from "./FichaCliente";
import { atenderSolicitud } from "./actions";
import { ORDENES, SEGMENTOS, cuandoToca, dia, etapaDe } from "./etapas";
import type { Ficha, Pagina } from "./tipos";

export const dynamic = "force-dynamic";

const POR_PAGINA = 25;

function Paginacion({
  desde, hasta, total, pagina, ultimaPagina, anterior, siguiente,
}: {
  desde: number; hasta: number; total: number;
  pagina: number; ultimaPagina: number;
  anterior: string; siguiente: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-miel-borde px-3 py-2 text-xs">
      <span className="text-cacao">
        {desde}–{hasta} de {total.toLocaleString("es-MX")}
      </span>
      <div className="flex gap-1.5">
        {pagina > 1 ? (
          <Link href={anterior} className="rounded-full border border-miel-borde px-2 py-0.5 font-semibold">←</Link>
        ) : (
          <span className="rounded-full border border-miel-borde px-2 py-0.5 text-cacao/40">←</span>
        )}
        <span className="self-center text-cacao">
          {pagina}/{ultimaPagina}
        </span>
        {pagina < ultimaPagina ? (
          <Link href={siguiente} className="rounded-full border border-miel-borde px-2 py-0.5 font-semibold">→</Link>
        ) : (
          <span className="rounded-full border border-miel-borde px-2 py-0.5 text-cacao/40">→</span>
        )}
      </div>
    </div>
  );
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; q?: string; f?: string; o?: string; p?: string; c?: string }>;
}) {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) {
    return <p className="text-cacao">Esta sección es para administradores de una tienda.</p>;
  }
  const t = perfil.tienda_id;
  const sp = await searchParams;

  const vista = sp.v === "tabla" ? "tabla" : "bandeja";
  const q = (sp.q ?? "").trim();
  const filtro = SEGMENTOS.some((s) => s.clave === sp.f) ? sp.f! : "seguir_hoy";
  const orden = sp.o && ORDENES[sp.o] ? sp.o : filtro === "seguir_hoy" ? "seguimiento" : "reciente";
  const pagina = Math.max(1, Number(sp.p) || 1);
  const sel = vista === "bandeja" && sp.c ? sp.c : null;

  const supabase = await createClient();
  const [{ data: pagData, error }, { data: tienda }, { data: solData }] = await Promise.all([
    supabase.rpc("clientes_pagina", {
      p_tienda: t,
      p_q: q || null,
      p_filtro: filtro,
      p_orden: orden,
      p_pagina: pagina,
      p_por: POR_PAGINA,
    }),
    supabase.from("tiendas").select("etiqueta_precio").eq("id", t).single(),
    supabase
      .from("solicitudes_cliente")
      .select("id, celular, texto, creado")
      .eq("tienda_id", t)
      .eq("estado", "abierta")
      .order("creado", { ascending: false })
      .limit(6),
  ]);

  const pag = (pagData ?? { total: 0, pagina: 1, por: POR_PAGINA, hoy: new Date().toISOString().slice(0, 10), filas: [], conteos: {} }) as Pagina;
  const simbolo = tienda?.etiqueta_precio ?? "$";
  const dinero = (n: number) => `${simbolo}${Number(n).toLocaleString("es-MX")}`;
  const solicitudes = (solData ?? []) as { id: string; celular: string | null; texto: string; creado: string }[];

  // La ficha del panel derecho solo se pide si hay alguien seleccionado.
  let ficha: Ficha | null = null;
  if (sel) {
    const { data } = await supabase.rpc("cliente_ficha", { p_tienda: t, p_celular: sel });
    ficha = (data as Ficha) ?? null;
  }

  const href = (cambios: Record<string, string | number | undefined | null>) => {
    const u = new URLSearchParams();
    const base = { v: vista, q, f: filtro, o: orden, p: pagina, c: sel, ...cambios };
    if (base.v && base.v !== "bandeja") u.set("v", String(base.v));
    if (base.q) u.set("q", String(base.q));
    if (base.f && base.f !== "seguir_hoy") u.set("f", String(base.f));
    if (base.o) u.set("o", String(base.o));
    if (base.p && Number(base.p) > 1) u.set("p", String(base.p));
    if (base.c) u.set("c", String(base.c));
    const s = u.toString();
    return `/admin/clientes${s ? `?${s}` : ""}`;
  };

  const desde = pag.total === 0 ? 0 : (pagina - 1) * POR_PAGINA + 1;
  const hasta = Math.min(pagina * POR_PAGINA, pag.total);
  const ultimaPagina = Math.max(1, Math.ceil(pag.total / POR_PAGINA));
  const alturaPane = "h-[calc(100dvh-20rem)] min-h-[22rem] md:h-[calc(100vh-19rem)]";

  const paginacion = {
    desde, hasta, total: pag.total, pagina, ultimaPagina,
    anterior: href({ p: pagina - 1 }),
    siguiente: href({ p: pagina + 1 }),
  };

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-titulo text-2xl text-durazno">Clientes</h1>
          <p className="text-sm text-cacao">
            {vista === "bandeja"
              ? "Tu lista de trabajo: a quién le toca que le escribas."
              : "Toda tu base de clientes, para revisar y ordenar."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Búsqueda: form GET, sin JavaScript. */}
          <form action="/admin/clientes" className="flex gap-2">
            {vista !== "bandeja" && <input type="hidden" name="v" value={vista} />}
            {filtro !== "seguir_hoy" && <input type="hidden" name="f" value={filtro} />}
            <input
              name="q"
              defaultValue={q}
              placeholder="Nombre, celular o correo…"
              className="w-52 rounded-full border border-miel-borde bg-white px-3 py-1.5 text-sm"
            />
            <button className="rounded-full bg-durazno px-3 py-1.5 text-sm font-bold text-white">Buscar</button>
          </form>
          <div className="flex overflow-hidden rounded-full border border-miel-borde text-xs font-semibold">
            <Link
              href={href({ v: "bandeja", p: 1 })}
              className={`px-3 py-1.5 ${vista === "bandeja" ? "bg-durazno text-white" : "bg-white text-cacao"}`}
            >
              Bandeja
            </Link>
            <Link
              href={href({ v: "tabla", p: 1, c: null })}
              className={`px-3 py-1.5 ${vista === "tabla" ? "bg-durazno text-white" : "bg-white text-cacao"}`}
            >
              Tabla
            </Link>
          </div>
        </div>
      </div>

      {/* Solicitudes abiertas: lo que alguien pidió y la tienda aún no atiende. */}
      {solicitudes.length > 0 && (
        <section className="rounded-[var(--radius-marca)] border border-dashed border-durazno bg-white p-3">
          <h2 className="mb-1.5 font-titulo text-sm text-coral">Solicitudes sin atender</h2>
          <ul className="space-y-1">
            {solicitudes.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-texto">
                  “{s.texto}”{" "}
                  {s.celular && (
                    <Link href={href({ c: s.celular, f: "solicitudes", p: 1 })} className="text-cacao underline">
                      · {s.celular}
                    </Link>
                  )}
                </span>
                <form action={atenderSolicitud}>
                  <input type="hidden" name="solicitud_id" value={s.id} />
                  <button className="shrink-0 rounded-full border border-miel-borde px-2 py-0.5 text-xs font-semibold">
                    Atendida
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Segmentos, con su conteo */}
      <div className="flex flex-wrap gap-1.5">
        {SEGMENTOS.map((s) => {
          const n = pag.conteos?.[s.clave] ?? 0;
          const activo = filtro === s.clave;
          return (
            <Link
              key={s.clave}
              href={href({ f: s.clave, p: 1, o: undefined })}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                activo ? "bg-durazno text-white" : "border border-miel-borde bg-white text-cacao"
              } ${n === 0 && !activo ? "opacity-50" : ""}`}
            >
              {s.nombre} <span className={activo ? "opacity-80" : "opacity-60"}>{n}</span>
            </Link>
          );
        })}
      </div>

      {error && (
        <p className="rounded-xl bg-coral/15 p-3 text-sm text-coral">
          No se pudo cargar la lista: {error.message}
        </p>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* BANDEJA: lista a la izquierda, ficha a la derecha                  */}
      {/* ---------------------------------------------------------------- */}
      {vista === "bandeja" && !error && (
        <div className="grid gap-4 md:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <div
            className={`${alturaPane} ${sel ? "hidden md:block" : "block"} min-h-0 overflow-hidden rounded-[var(--radius-marca)] border border-miel-borde bg-white`}
          >
            <div className="flex h-full min-h-0 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto">
                {pag.filas.length === 0 ? (
                  <p className="p-4 text-sm text-cacao">
                    {filtro === "seguir_hoy"
                      ? "Nadie pendiente de seguimiento hoy. Abre otro segmento y agenda a quien quieras contactar."
                      : "Ningún cliente en este segmento."}
                  </p>
                ) : (
                  <ul className="divide-y divide-miel-borde">
                    {pag.filas.map((c) => {
                      const etapa = etapaDe(c.etapa);
                      const toca = cuandoToca(c.proximo_seguimiento, pag.hoy);
                      const activo = sel === c.celular;
                      return (
                        <li key={c.celular}>
                          <Link
                            href={href({ c: c.celular })}
                            className={`block px-3 py-2 ${activo ? "bg-crema" : "hover:bg-crema/50"}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="min-w-0 truncate font-producto font-bold text-texto">
                                {c.nombre ?? "Cliente"}
                              </span>
                              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${etapa.cls}`}>
                                {etapa.nombre}
                              </span>
                              {c.gastado > 0 && (
                                <span className="ml-auto shrink-0 text-xs font-semibold tabular-nums text-[#7a5414]">
                                  {dinero(c.gastado)}
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-cacao">
                              <span>{c.celular}</span>
                              {toca && (
                                <span className={`font-bold ${toca.vencido ? "text-coral" : "text-[#7a5a14]"}`}>
                                  · le toca {toca.txt}
                                </span>
                              )}
                              <span className="ml-auto shrink-0">{dia(c.ultima_visita)}</span>
                            </div>
                            {c.seguimiento_nota && (
                              <p className="mt-0.5 truncate text-[11px] italic text-cacao">“{c.seguimiento_nota}”</p>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              {pag.total > POR_PAGINA && <Paginacion {...paginacion} />}
            </div>
          </div>

          <div className={`${alturaPane} ${sel ? "block" : "hidden md:block"} min-h-0 overflow-y-auto`}>
            {ficha ? (
              <>
                <Link href={href({ c: null })} className="mb-2 inline-block text-sm text-cacao underline md:hidden">
                  ← Lista
                </Link>
                <FichaCliente f={ficha} simbolo={simbolo} compacta />
              </>
            ) : (
              <div className="grid h-full place-items-center rounded-[var(--radius-marca)] border border-dashed border-miel-borde bg-white/60 p-6 text-center text-sm text-cacao">
                Elige un cliente de la lista para ver su ficha y agendarle seguimiento.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* TABLA: la base completa, ordenable                                */}
      {/* ---------------------------------------------------------------- */}
      {vista === "tabla" && !error && (
        <>
          {pag.filas.length === 0 ? (
            <p className="rounded-xl bg-miel/30 p-4 text-sm text-[#7a5a14]">
              {q ? "Ningún cliente coincide con esta búsqueda." : "Ningún cliente en este segmento."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-[var(--radius-marca)] border border-miel-borde bg-white">
              <table className="w-full text-sm">
                <thead className="border-b border-miel-borde bg-crema/60 text-left text-xs uppercase tracking-wide text-cacao">
                  <tr>
                    <th className="px-3 py-2 font-semibold">
                      <Link href={href({ o: "nombre", p: 1 })}>Cliente</Link>
                    </th>
                    <th className="px-3 py-2 font-semibold">Etapa</th>
                    <th className="hidden px-3 py-2 font-semibold lg:table-cell">Interés</th>
                    <th className="px-3 py-2 font-semibold">
                      <Link href={href({ o: "seguimiento", p: 1 })}>Seguimiento</Link>
                    </th>
                    <th className="px-3 py-2 text-right font-semibold">
                      <Link href={href({ o: "pedidos", p: 1 })}>Pedidos</Link>
                    </th>
                    <th className="px-3 py-2 text-right font-semibold">
                      <Link href={href({ o: "gastado", p: 1 })}>Gastado</Link>
                    </th>
                    <th className="hidden px-3 py-2 text-right font-semibold sm:table-cell">
                      <Link href={href({ o: "reciente", p: 1 })}>Últ. visita</Link>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-miel-borde">
                  {pag.filas.map((c) => {
                    const etapa = etapaDe(c.etapa);
                    const toca = cuandoToca(c.proximo_seguimiento, pag.hoy);
                    return (
                      <tr key={c.celular} className="align-top hover:bg-crema/40">
                        <td className="px-3 py-2">
                          <Link
                            href={`/admin/clientes/${encodeURIComponent(c.celular)}`}
                            className="font-producto font-bold text-texto hover:text-coral"
                          >
                            {c.nombre ?? "Cliente"}
                          </Link>
                          <div className="text-xs text-cacao">{c.celular}</div>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {c.solicitudes > 0 && (
                              <span className="rounded-full bg-coral/15 px-1.5 py-0.5 text-[10px] font-bold text-coral">
                                {c.solicitudes} solicitud{c.solicitudes === 1 ? "" : "es"}
                              </span>
                            )}
                            {c.no_molestar && (
                              <span className="rounded-full bg-cacao/15 px-1.5 py-0.5 text-[10px] font-bold text-cacao">
                                No molestar
                              </span>
                            )}
                            {c.tiene_nota && <span className="text-[10px] text-cacao">📝</span>}
                            {c.etiquetas.map((e) => (
                              <span
                                key={e}
                                className="rounded-full bg-verde-mielina/25 px-1.5 py-0.5 text-[10px] font-bold text-[#3f5a1c]"
                              >
                                {e}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${etapa.cls}`}>
                            {etapa.nombre}
                          </span>
                          {c.etapa_manual && <span className="ml-1 text-[10px] text-cacao">✋</span>}
                        </td>
                        <td className="hidden px-3 py-2 lg:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {c.intereses.length === 0 && <span className="text-xs text-cacao">—</span>}
                            {c.intereses.map((i) => (
                              <span key={i} className="rounded-full bg-miel px-1.5 py-0.5 text-[10px] text-[#7a5a14]">
                                {i}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {toca ? (
                            <span className={`font-bold ${toca.vencido ? "text-coral" : "text-[#7a5a14]"}`}>
                              {toca.txt}
                            </span>
                          ) : (
                            <span className="text-cacao">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-texto">
                          {c.pedidos === 0 ? <span className="text-cacao">—</span> : c.pedidos}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-[#7a5414]">
                          {c.gastado > 0 ? dinero(c.gastado) : <span className="font-normal text-cacao">—</span>}
                        </td>
                        <td className="hidden px-3 py-2 text-right text-xs text-cacao sm:table-cell">
                          {dia(c.ultima_visita)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {pag.total > POR_PAGINA && <Paginacion {...paginacion} />}
            </div>
          )}
        </>
      )}
    </div>
  );
}
