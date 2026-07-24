import Link from "next/link";
import { notFound } from "next/navigation";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EnviarMensaje } from "../EnviarMensaje";
import { alternarNoMolestar, guardarEtiquetas, guardarNota } from "../actions";

export const dynamic = "force-dynamic";

type Ficha = {
  cliente: {
    celular: string;
    nombre: string | null;
    correo: string | null;
    creado: string;
    ultima_visita: string;
    etiquetas: string[];
    nota: string | null;
    no_molestar: boolean;
  };
  resumen: {
    pedidos: number;
    pagados: number;
    pendientes: number;
    gastado: number;
    ticket: number;
    primer_pedido: string | null;
    ultimo_pedido: string | null;
  };
  intereses: { nombre: string; n: number }[];
  pedidos: { id: string; folio: number; estado: string; total: number; creado: string; items: number }[];
  solicitudes: { id: string; texto: string; estado: string; creado: string }[];
  mensajes: { canal: string; cuerpo: string; hora: string }[];
  conversaciones: { id: string; canal: string | null; estado: string; ultimo: string }[];
  actividad: { tipo: string; nombre: string | null; hora: string }[];
};

const ESTADO_PEDIDO: Record<string, string> = {
  pendiente: "bg-durazno/30 text-[#7a3a26]",
  pagado: "bg-verde-mielina/30 text-[#3f5a1c]",
  cancelado: "bg-cacao/20 text-cacao",
  devuelto: "bg-coral/15 text-coral",
};

// Nombres legibles para los tipos de evento que guarda la bitácora.
const ACTIVIDAD: Record<string, string> = {
  abrir_producto: "Vio",
  ver_nido: "Abrió el nido",
  buscar: "Buscó",
  apartar: "Apartó",
  liberar: "Soltó",
  vencer: "Se le venció el apartado de",
  pasar_siguiente: "Le tocó turno de",
  unir_cola: "Se formó por",
  salir_cola: "Salió de la fila de",
  pedido: "Generó un pedido",
  comprar: "Compró",
  vender: "Compró",
};

function cuando(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}
function dia(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function FichaClientePage({
  params,
}: {
  params: Promise<{ celular: string }>;
}) {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) {
    return <p className="text-cacao">Esta sección es para administradores de una tienda.</p>;
  }
  const t = perfil.tienda_id;
  const { celular: celularParam } = await params;
  const celular = decodeURIComponent(celularParam);

  const supabase = await createClient();
  const [{ data, error }, { data: tienda }] = await Promise.all([
    supabase.rpc("cliente_ficha", { p_tienda: t, p_celular: celular }),
    supabase.from("tiendas").select("etiqueta_precio").eq("id", t).single(),
  ]);

  if (error) {
    return (
      <div className="max-w-3xl space-y-3">
        <Link href="/admin/clientes" className="text-sm text-cacao underline">← Clientes</Link>
        <p className="rounded-xl bg-coral/15 p-3 text-sm text-coral">
          No se pudo cargar la ficha: {error.message}
        </p>
      </div>
    );
  }
  if (!data) notFound();

  const f = data as Ficha;
  const simbolo = tienda?.etiqueta_precio ?? "$";
  const dinero = (n: number) => `${simbolo}${Number(n).toLocaleString("es-MX")}`;
  const wa = `https://wa.me/${f.cliente.celular.replace(/\D/g, "")}`;

  return (
    <div className="max-w-5xl space-y-5">
      <Link href="/admin/clientes" className="text-sm text-cacao underline">← Clientes</Link>

      {/* Encabezado */}
      <div className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-titulo text-2xl text-durazno">{f.cliente.nombre ?? "Cliente"}</h1>
          {f.cliente.no_molestar && (
            <span className="rounded-full bg-cacao/15 px-2 py-0.5 text-xs font-bold text-cacao">
              No molestar
            </span>
          )}
          {f.cliente.etiquetas.map((e) => (
            <span
              key={e}
              className="rounded-full bg-verde-mielina/25 px-2 py-0.5 text-xs font-bold text-[#3f5a1c]"
            >
              {e}
            </span>
          ))}
        </div>
        <p className="mt-1 text-sm text-cacao">
          <a href={wa} target="_blank" rel="noopener noreferrer" className="font-semibold text-verde-mielina underline">
            {f.cliente.celular}
          </a>
          {f.cliente.correo && ` · ${f.cliente.correo}`}
        </p>
        <p className="mt-1 text-xs text-cacao">
          Cliente desde {dia(f.cliente.creado)} · última visita {dia(f.cliente.ultima_visita)}
        </p>

        {f.intereses.length > 0 && (
          <p className="mt-2 flex flex-wrap items-center gap-1 text-xs text-cacao">
            Le interesa:
            {f.intereses.map((i) => (
              <span key={i.nombre} className="rounded-full bg-miel px-2 py-0.5 text-[#7a5a14]">
                {i.nombre} <span className="opacity-60">×{i.n}</span>
              </span>
            ))}
          </p>
        )}
      </div>

      {/* Resumen de compra */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { t: "Gastado", v: dinero(f.resumen.gastado), n: `${f.resumen.pagados} pagados` },
          { t: "Ticket promedio", v: dinero(f.resumen.ticket) },
          { t: "Pedidos", v: String(f.resumen.pedidos), n: `${f.resumen.pendientes} por cobrar` },
          { t: "Último pedido", v: dia(f.resumen.ultimo_pedido) },
        ].map((k) => (
          <div key={k.t} className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-3">
            <p className="text-[11px] uppercase tracking-wide text-cacao">{k.t}</p>
            <p className="font-producto text-xl font-bold text-texto">{k.v}</p>
            {k.n && <p className="text-[11px] text-cacao">{k.n}</p>}
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* Columna izquierda: lo que la tienda escribe y envía */}
        <div className="space-y-4">
          <section className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
            <h2 className="mb-2 font-titulo text-coral">Escribirle</h2>
            <EnviarMensaje
              celular={f.cliente.celular}
              correo={f.cliente.correo}
              nombre={f.cliente.nombre ?? ""}
            />
          </section>

          <section className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
            <h2 className="mb-2 font-titulo text-coral">Nota privada</h2>
            <form action={guardarNota} className="space-y-2">
              <input type="hidden" name="celular" value={f.cliente.celular} />
              <textarea
                name="nota"
                rows={3}
                defaultValue={f.cliente.nota ?? ""}
                placeholder="Talla 4, prefiere colores neutros, pregunta por envíos a Juárez…"
                className="w-full rounded-lg border border-miel-borde bg-crema/40 px-2 py-1.5 text-sm"
              />
              <button className="rounded-full bg-durazno px-3 py-1 text-sm font-bold text-white">
                Guardar nota
              </button>
            </form>
          </section>

          <section className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
            <h2 className="mb-2 font-titulo text-coral">Etiquetas</h2>
            <form action={guardarEtiquetas} className="space-y-2">
              <input type="hidden" name="celular" value={f.cliente.celular} />
              <input
                name="etiquetas"
                defaultValue={f.cliente.etiquetas.join(", ")}
                placeholder="mayorista, frecuente, Juárez"
                className="w-full rounded-lg border border-miel-borde bg-crema/40 px-2 py-1.5 text-sm"
              />
              <p className="text-[11px] text-cacao">Sepáralas con comas. Sirven para filtrar la lista.</p>
              <button className="rounded-full bg-durazno px-3 py-1 text-sm font-bold text-white">
                Guardar etiquetas
              </button>
            </form>

            <form action={alternarNoMolestar} className="mt-3 border-t border-miel-borde pt-3">
              <input type="hidden" name="celular" value={f.cliente.celular} />
              <input type="hidden" name="valor" value={f.cliente.no_molestar ? "0" : "1"} />
              <button className="rounded-full border border-miel-borde px-3 py-1 text-xs font-semibold text-cacao">
                {f.cliente.no_molestar ? "Quitar “no molestar”" : "Marcar “no molestar”"}
              </button>
            </form>
          </section>
        </div>

        {/* Columna derecha: historial */}
        <div className="space-y-4">
          <section className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
            <h2 className="mb-2 font-titulo text-coral">Pedidos</h2>
            {f.pedidos.length === 0 ? (
              <p className="text-sm text-cacao">Todavía no ha hecho ningún pedido.</p>
            ) : (
              <ul className="divide-y divide-miel-borde text-sm">
                {f.pedidos.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 py-1.5">
                    <Link href={`/admin/pedidos?q=${p.folio}`} className="font-semibold text-texto hover:text-coral">
                      #{p.folio}
                    </Link>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ESTADO_PEDIDO[p.estado] ?? ""}`}>
                      {p.estado}
                    </span>
                    <span className="text-xs text-cacao">
                      {p.items} {p.items === 1 ? "prenda" : "prendas"}
                    </span>
                    <span className="ml-auto font-semibold tabular-nums text-[#7a5414]">{dinero(p.total)}</span>
                    <span className="hidden text-xs text-cacao sm:inline">{dia(p.creado)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {f.conversaciones.length > 0 && (
            <section className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
              <h2 className="mb-2 font-titulo text-coral">Chats con el agente</h2>
              <ul className="space-y-1 text-sm">
                {f.conversaciones.map((c) => (
                  <li key={c.id}>
                    <Link href={`/admin/conversaciones?c=${c.id}`} className="text-texto underline hover:text-coral">
                      {c.canal ?? "chat"} · {c.estado}
                    </Link>
                    <span className="ml-2 text-xs text-cacao">{cuando(c.ultimo)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {f.solicitudes.length > 0 && (
            <section className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
              <h2 className="mb-2 font-titulo text-coral">Lo que ha pedido</h2>
              <ul className="space-y-1 text-sm">
                {f.solicitudes.map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <span className="text-texto">“{s.texto}”</span>
                    {s.estado === "abierta" && (
                      <span className="rounded-full bg-coral/15 px-1.5 py-0.5 text-[10px] font-bold text-coral">
                        abierta
                      </span>
                    )}
                    <span className="ml-auto text-xs text-cacao">{dia(s.creado)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {f.mensajes.length > 0 && (
            <section className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
              <h2 className="mb-2 font-titulo text-coral">Mensajes que le enviaste</h2>
              <ul className="space-y-2 text-sm">
                {f.mensajes.map((m, i) => (
                  <li key={i} className="rounded-lg bg-crema/50 px-2 py-1.5">
                    <p className="text-texto">{m.cuerpo}</p>
                    <p className="text-[11px] text-cacao">
                      {m.canal} · {cuando(m.hora)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
            <h2 className="mb-2 font-titulo text-coral">Actividad reciente</h2>
            {f.actividad.length === 0 ? (
              <p className="text-sm text-cacao">Sin actividad registrada.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {f.actividad.map((a, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-texto">
                      {ACTIVIDAD[a.tipo] ?? a.tipo} {a.nombre && <strong>{a.nombre}</strong>}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-cacao">{cuando(a.hora)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
