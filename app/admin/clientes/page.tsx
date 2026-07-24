import Link from "next/link";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { atenderSolicitud } from "./actions";

export const dynamic = "force-dynamic";

const POR_PAGINA = 25;

// Una fila tal como la devuelve la RPC clientes_pagina (todo resuelto en SQL).
type Fila = {
  celular: string;
  nombre: string | null;
  correo: string | null;
  ultima_visita: string;
  etiquetas: string[];
  tiene_nota: boolean;
  no_molestar: boolean;
  pedidos: number;
  pagados: number;
  pendientes: number;
  gastado: number;
  ultimo_pedido: string | null;
  solicitudes: number;
  intereses: string[];
};
type Pagina = { total: number; pagina: number; por: number; filas: Fila[] };

const FILTROS = [
  { clave: "todos", nombre: "Todos" },
  { clave: "pendientes", nombre: "Con pedido pendiente" },
  { clave: "compradores", nombre: "Compradores" },
  { clave: "nuevos", nombre: "Sin comprar" },
  { clave: "solicitudes", nombre: "Con solicitud" },
  { clave: "dormidos", nombre: "Dormidos (+60 d)" },
];

const ORDENES: Record<string, string> = {
  reciente: "Última visita",
  gastado: "Gastado",
  pedidos: "Pedidos",
  nombre: "Nombre",
};

function dia(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" });
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; f?: string; o?: string; p?: string }>;
}) {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) {
    return <p className="text-cacao">Esta sección es para administradores de una tienda.</p>;
  }
  const t = perfil.tienda_id;
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const filtro = FILTROS.some((f) => f.clave === sp.f) ? sp.f! : "todos";
  const orden = sp.o && ORDENES[sp.o] ? sp.o : "reciente";
  const pagina = Math.max(1, Number(sp.p) || 1);

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

  const pag = (pagData ?? { total: 0, pagina: 1, por: POR_PAGINA, filas: [] }) as Pagina;
  const simbolo = tienda?.etiqueta_precio ?? "$";
  const solicitudes = (solData ?? []) as { id: string; celular: string | null; texto: string; creado: string }[];
  const dinero = (n: number) => `${simbolo}${Number(n).toLocaleString("es-MX")}`;

  // Conserva el estado de la vista al cambiar un solo parámetro.
  const href = (cambios: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const base = { q, f: filtro, o: orden, p: pagina, ...cambios };
    if (base.q) p.set("q", String(base.q));
    if (base.f && base.f !== "todos") p.set("f", String(base.f));
    if (base.o && base.o !== "reciente") p.set("o", String(base.o));
    if (base.p && Number(base.p) > 1) p.set("p", String(base.p));
    const s = p.toString();
    return `/admin/clientes${s ? `?${s}` : ""}`;
  };

  const desde = pag.total === 0 ? 0 : (pagina - 1) * POR_PAGINA + 1;
  const hasta = Math.min(pagina * POR_PAGINA, pag.total);
  const ultimaPagina = Math.max(1, Math.ceil(pag.total / POR_PAGINA));

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-titulo text-2xl text-durazno">Clientes</h1>
          <p className="text-sm text-cacao">
            {pag.total.toLocaleString("es-MX")} {pag.total === 1 ? "cliente" : "clientes"}
            {q && ` que coinciden con “${q}”`}. Toca uno para ver su ficha completa.
          </p>
        </div>
        {/* Búsqueda: form GET, sin JavaScript. */}
        <form action="/admin/clientes" className="flex gap-2">
          {filtro !== "todos" && <input type="hidden" name="f" value={filtro} />}
          {orden !== "reciente" && <input type="hidden" name="o" value={orden} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Nombre, celular o correo…"
            className="w-56 rounded-full border border-miel-borde bg-white px-3 py-1.5 text-sm"
          />
          <button className="rounded-full bg-durazno px-3 py-1.5 text-sm font-bold text-white">
            Buscar
          </button>
          {q && (
            <Link href={href({ q: "", p: 1 })} className="self-center text-sm text-cacao underline">
              Limpiar
            </Link>
          )}
        </form>
      </div>

      {/* Solicitudes abiertas: lo que alguien pidió y la tienda aún no atiende. */}
      {solicitudes.length > 0 && (
        <section className="rounded-[var(--radius-marca)] border border-dashed border-durazno bg-white p-4">
          <h2 className="mb-2 font-titulo text-coral">Solicitudes abiertas</h2>
          <ul className="space-y-2">
            {solicitudes.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-texto">
                  “{s.texto}”{" "}
                  {s.celular && (
                    <Link
                      href={`/admin/clientes/${encodeURIComponent(s.celular)}`}
                      className="text-cacao underline"
                    >
                      · {s.celular}
                    </Link>
                  )}
                </span>
                <form action={atenderSolicitud}>
                  <input type="hidden" name="solicitud_id" value={s.id} />
                  <button className="rounded-full border border-miel-borde px-2 py-1 text-xs font-semibold">
                    Atendida
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <Link href={href({ f: "solicitudes", p: 1 })} className="mt-2 inline-block text-xs text-cacao underline">
            Ver todos los clientes con solicitud →
          </Link>
        </section>
      )}

      {/* Segmentos */}
      <div className="flex flex-wrap gap-1.5">
        {FILTROS.map((f) => (
          <Link
            key={f.clave}
            href={href({ f: f.clave, p: 1 })}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              filtro === f.clave
                ? "bg-durazno text-white"
                : "border border-miel-borde bg-white text-cacao"
            }`}
          >
            {f.nombre}
          </Link>
        ))}
      </div>

      {error && (
        <p className="rounded-xl bg-coral/15 p-3 text-sm text-coral">
          No se pudo cargar la lista: {error.message}
        </p>
      )}

      {pag.filas.length === 0 && !error && (
        <p className="rounded-xl bg-miel/30 p-4 text-sm text-[#7a5a14]">
          {q || filtro !== "todos"
            ? "Ningún cliente coincide con esta búsqueda."
            : "Aún no hay clientes registrados."}
        </p>
      )}

      {pag.filas.length > 0 && (
        <div className="overflow-hidden rounded-[var(--radius-marca)] border border-miel-borde bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-miel-borde bg-crema/60 text-left text-xs uppercase tracking-wide text-cacao">
              <tr>
                <th className="px-3 py-2 font-semibold">
                  <Link href={href({ o: "nombre", p: 1 })}>Cliente</Link>
                </th>
                <th className="hidden px-3 py-2 font-semibold md:table-cell">Interés</th>
                <th className="px-3 py-2 text-right font-semibold">
                  <Link href={href({ o: "pedidos", p: 1 })}>Pedidos</Link>
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  <Link href={href({ o: "gastado", p: 1 })}>Gastado</Link>
                </th>
                <th className="hidden px-3 py-2 text-right font-semibold sm:table-cell">
                  <Link href={href({ o: "reciente", p: 1 })}>Últ. visita</Link>
                </th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-miel-borde">
              {pag.filas.map((c) => (
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
                      {c.pendientes > 0 && (
                        <span className="rounded-full bg-durazno/25 px-1.5 py-0.5 text-[10px] font-bold text-[#7a3a26]">
                          {c.pendientes} por cobrar
                        </span>
                      )}
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
                  <td className="hidden px-3 py-2 md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {c.intereses.length === 0 && <span className="text-xs text-cacao">—</span>}
                      {c.intereses.map((i) => (
                        <span key={i} className="rounded-full bg-miel px-1.5 py-0.5 text-[10px] text-[#7a5a14]">
                          {i}
                        </span>
                      ))}
                    </div>
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
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/admin/clientes/${encodeURIComponent(c.celular)}`}
                      className="rounded-full border border-miel-borde px-2 py-1 text-xs font-semibold text-cacao"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación */}
      {pag.total > POR_PAGINA && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-cacao">
            {desde}–{hasta} de {pag.total.toLocaleString("es-MX")}
          </span>
          <div className="flex gap-2">
            {pagina > 1 ? (
              <Link
                href={href({ p: pagina - 1 })}
                className="rounded-full border border-miel-borde bg-white px-3 py-1 font-semibold"
              >
                ← Anterior
              </Link>
            ) : (
              <span className="rounded-full border border-miel-borde px-3 py-1 text-cacao/50">← Anterior</span>
            )}
            <span className="self-center text-xs text-cacao">
              {pagina} / {ultimaPagina}
            </span>
            {pagina < ultimaPagina ? (
              <Link
                href={href({ p: pagina + 1 })}
                className="rounded-full border border-miel-borde bg-white px-3 py-1 font-semibold"
              >
                Siguiente →
              </Link>
            ) : (
              <span className="rounded-full border border-miel-borde px-3 py-1 text-cacao/50">Siguiente →</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
