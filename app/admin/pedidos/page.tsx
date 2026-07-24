import Link from "next/link";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Pedido } from "@/lib/tipos";
import { AccionesPedido } from "./AccionesPedido";

export const dynamic = "force-dynamic";

const POR_PAGINA = 20;

const ESTADO: Record<string, { txt: string; cls: string }> = {
  pendiente: { txt: "Pendiente de pago", cls: "bg-durazno/30 text-[#7a3a26]" },
  pagado: { txt: "Pagado ✓", cls: "bg-verde-mielina/30 text-[#3f5a1c]" },
  cancelado: { txt: "Cancelado", cls: "bg-cacao/20 text-cacao" },
  devuelto: { txt: "Devuelto ↩︎", cls: "bg-coral/15 text-coral" },
};

const FILTROS = [
  { clave: "todos", nombre: "Todos" },
  { clave: "pendiente", nombre: "Por cobrar" },
  { clave: "pagado", nombre: "Pagados" },
  { clave: "cancelado", nombre: "Cancelados" },
  { clave: "devuelto", nombre: "Devueltos" },
];

function wa(celular: string | null, texto: string) {
  if (!celular) return "#";
  return `https://wa.me/${celular.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;
}

function fecha(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; q?: string; p?: string }>;
}) {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) {
    return <p className="text-cacao">Esta sección es para administradores de una tienda.</p>;
  }
  const t = perfil.tienda_id;
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const estado = FILTROS.some((f) => f.clave === sp.e) ? sp.e! : "todos";
  const pagina = Math.max(1, Number(sp.p) || 1);
  const desdeFila = (pagina - 1) * POR_PAGINA;

  const supabase = await createClient();

  // Consulta paginada. La búsqueda por número entiende tanto folio como celular.
  let consulta = supabase
    .from("pedidos")
    .select("*", { count: "exact" })
    .eq("tienda_id", t)
    .order("creado", { ascending: false })
    .range(desdeFila, desdeFila + POR_PAGINA - 1);

  if (estado !== "todos") consulta = consulta.eq("estado", estado);
  if (q) {
    // Solo tratamos la búsqueda como número (folio o celular) si NO trae
    // letras: si no, buscar "Ana 2" colaría el 2 y casaría con medio mundo.
    const esNumerica = /^[\d\s+()-]+$/.test(q);
    const digitos = esNumerica ? q.replace(/\D/g, "") : "";
    // Las comas y paréntesis rompen la sintaxis de .or() de PostgREST.
    const texto = q.replace(/[,()]/g, " ").trim();
    const partes: string[] = [];
    if (texto) partes.push(`cliente_nombre.ilike.%${texto}%`, `cliente_correo.ilike.%${texto}%`);
    if (digitos) {
      partes.push(`cliente_celular.ilike.%${digitos}%`);
      if (digitos.length <= 9) partes.push(`folio.eq.${Number(digitos)}`);
    }
    if (partes.length) consulta = consulta.or(partes.join(","));
  }

  // Conteos por estado: alimentan las pestañas sin traer las filas.
  const conteo = (e: string) => {
    const c = supabase
      .from("pedidos")
      .select("id", { count: "exact", head: true })
      .eq("tienda_id", t);
    return e === "todos" ? c : c.eq("estado", e);
  };

  const [{ data: pedidosData, count, error }, { data: tienda }, ...conteos] = await Promise.all([
    consulta,
    supabase.from("tiendas").select("etiqueta_precio").eq("id", t).single(),
    ...FILTROS.map((f) => conteo(f.clave)),
  ]);

  const pedidos = (pedidosData ?? []) as Pedido[];
  const simbolo = tienda?.etiqueta_precio ?? "$";
  const total = count ?? 0;
  const porEstado = Object.fromEntries(FILTROS.map((f, i) => [f.clave, conteos[i]?.count ?? 0]));
  const pendientes = porEstado.pendiente ?? 0;
  const ultimaPagina = Math.max(1, Math.ceil(total / POR_PAGINA));

  const href = (cambios: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const base = { e: estado, q, p: pagina, ...cambios };
    if (base.e && base.e !== "todos") p.set("e", String(base.e));
    if (base.q) p.set("q", String(base.q));
    if (base.p && Number(base.p) > 1) p.set("p", String(base.p));
    const s = p.toString();
    return `/admin/pedidos${s ? `?${s}` : ""}`;
  };

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-titulo text-2xl text-durazno">Pedidos</h1>
          <p className="max-w-xl text-sm text-cacao">
            Cuando un cliente toca <strong>“Generar pedido”</strong> aparece aquí. Coordina el
            pago por WhatsApp y, al recibirlo, toca <strong>Confirmar pago</strong> para marcar
            las prendas como vendidas.
          </p>
        </div>
        <form action="/admin/pedidos" className="flex gap-2">
          {estado !== "todos" && <input type="hidden" name="e" value={estado} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Folio, nombre o celular…"
            className="w-52 rounded-full border border-miel-borde bg-white px-3 py-1.5 text-sm"
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

      {pendientes > 0 && estado !== "pendiente" && (
        <Link
          href={href({ e: "pendiente", p: 1 })}
          className="block rounded-xl bg-durazno/15 p-3 text-sm font-semibold text-[#7a3a26]"
        >
          Tienes {pendientes} {pendientes === 1 ? "pedido pendiente" : "pedidos pendientes"} de pago. Verlos →
        </Link>
      )}

      {/* Pestañas por estado, con su conteo */}
      <div className="flex flex-wrap gap-1.5">
        {FILTROS.map((f) => (
          <Link
            key={f.clave}
            href={href({ e: f.clave, p: 1 })}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              estado === f.clave
                ? "bg-durazno text-white"
                : "border border-miel-borde bg-white text-cacao"
            }`}
          >
            {f.nombre}{" "}
            <span className={estado === f.clave ? "opacity-80" : "opacity-60"}>
              {porEstado[f.clave] ?? 0}
            </span>
          </Link>
        ))}
      </div>

      {error && (
        <p className="rounded-xl bg-coral/15 p-3 text-sm text-coral">
          No se pudieron cargar los pedidos: {error.message}
        </p>
      )}

      {pedidos.length === 0 && !error && (
        <p className="rounded-xl bg-miel/30 p-4 text-sm text-[#7a5a14]">
          {q || estado !== "todos"
            ? "Ningún pedido coincide con esta búsqueda."
            : "Aún no hay pedidos. Cuando una clienta genere uno desde su carrito, lo verás aquí."}
        </p>
      )}

      <div className="space-y-2">
        {pedidos.map((p) => {
          const est = ESTADO[p.estado] ?? { txt: p.estado, cls: "bg-cacao/20 text-cacao" };
          const abierto = p.estado === "pendiente";
          return (
            <details
              key={p.id}
              open={abierto}
              className="group rounded-[var(--radius-marca)] border border-miel-borde bg-white"
            >
              {/* Resumen: una línea por pedido. Se despliega para ver el detalle. */}
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-3">
                <span className="font-titulo text-coral">#{p.folio}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${est.cls}`}>{est.txt}</span>
                <span className="text-sm text-texto">
                  {p.cliente_nombre || "Cliente"}
                  <span className="text-cacao">
                    {" · "}
                    {p.items.length} {p.items.length === 1 ? "prenda" : "prendas"}
                  </span>
                </span>
                <span className="ml-auto font-producto font-bold tabular-nums text-texto">
                  {simbolo}
                  {p.total}
                </span>
                <span className="w-full text-xs text-cacao sm:w-auto">{fecha(p.creado)}</span>
                <span className="text-xs text-cacao group-open:hidden">▾</span>
                <span className="hidden text-xs text-cacao group-open:inline">▴</span>
              </summary>

              <div className="border-t border-miel-borde p-3 pt-2">
                {/* Cliente */}
                <p className="text-sm text-texto">
                  {p.cliente_celular ? (
                    <>
                      <a
                        href={wa(p.cliente_celular, `¡Hola! Sobre tu pedido #${p.folio} en la tienda 🍯`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-verde-mielina underline"
                      >
                        {p.cliente_celular}
                      </a>
                      {" · "}
                      <Link
                        href={`/admin/clientes/${encodeURIComponent(p.cliente_celular)}`}
                        className="text-cacao underline"
                      >
                        ver ficha
                      </Link>
                    </>
                  ) : (
                    <span className="text-cacao">Sin celular</span>
                  )}
                  {p.cliente_correo && <span className="text-cacao"> · {p.cliente_correo}</span>}
                </p>

                {/* Prendas */}
                <ul className="mt-2 divide-y divide-miel-borde rounded-xl bg-crema/60 px-3">
                  {p.items.map((it, i) => (
                    <li key={i} className="flex justify-between py-1.5 text-sm">
                      <span className="text-texto">{it.nombre}</span>
                      <span className="font-semibold text-[#7a5414]">
                        {simbolo}
                        {it.precio}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Totales */}
                <div className="mt-2 text-right text-sm">
                  {p.descuento > 0 && (
                    <p className="text-cacao">
                      Subtotal {simbolo}
                      {p.subtotal} · Cupón {p.cupon} −{simbolo}
                      {p.descuento}
                    </p>
                  )}
                  <p className="font-producto text-lg font-bold text-texto">
                    Total: {simbolo}
                    {p.total}
                  </p>
                </div>

                {/* Rastro de lo que pasó con el pedido */}
                {p.estado === "pagado" && p.confirmado_en && (
                  <p className="mt-2 text-xs text-[#3f5a1c]">Pagado el {fecha(p.confirmado_en)}.</p>
                )}
                {p.estado === "devuelto" && p.devuelto_en && (
                  <p className="mt-2 text-xs text-coral">Devuelto el {fecha(p.devuelto_en)}.</p>
                )}
                {p.motivo && <p className="mt-1 text-xs text-cacao">Motivo: “{p.motivo}”</p>}

                <AccionesPedido pedidoId={p.id} folio={p.folio} estado={p.estado} />
              </div>
            </details>
          );
        })}
      </div>

      {/* Paginación */}
      {total > POR_PAGINA && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-cacao">
            {desdeFila + 1}–{Math.min(pagina * POR_PAGINA, total)} de {total.toLocaleString("es-MX")}
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
