import Link from "next/link";
import { EnviarMensaje } from "./EnviarMensaje";
import { Seguimiento } from "./Seguimiento";
import { alternarNoMolestar, guardarEtiquetas, guardarNota } from "./actions";
import { ACTIVIDAD, ICONO_TIEMPO, cuando, dia, etapaDe } from "./etapas";
import type { Ficha } from "./tipos";

const ESTADO_PEDIDO: Record<string, string> = {
  pendiente: "bg-durazno/30 text-[#7a3a26]",
  pagado: "bg-verde-mielina/30 text-[#3f5a1c]",
  cancelado: "bg-cacao/20 text-cacao",
  devuelto: "bg-coral/15 text-coral",
};

// La ficha del cliente. La usan tanto la página completa
// (/admin/clientes/[celular]) como el panel derecho de la bandeja; en el
// panel va a una sola columna porque el ancho es la mitad.
export function FichaCliente({
  f,
  simbolo,
  compacta = false,
}: {
  f: Ficha;
  simbolo: string;
  compacta?: boolean;
}) {
  const c = f.cliente;
  const dinero = (n: number) => `${simbolo}${Number(n).toLocaleString("es-MX")}`;
  const wa = `https://wa.me/${c.celular.replace(/\D/g, "")}`;
  const etapa = etapaDe(c.etapa);

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-titulo text-xl text-durazno">{c.nombre ?? "Cliente"}</h2>
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${etapa.cls}`}>
            {etapa.nombre}
          </span>
          {c.dormido && (
            <span className="rounded-full bg-cacao/15 px-2 py-0.5 text-xs font-bold text-cacao">
              Dormido
            </span>
          )}
          {c.no_molestar && (
            <span className="rounded-full bg-coral/15 px-2 py-0.5 text-xs font-bold text-coral">
              No molestar
            </span>
          )}
          {compacta && (
            <Link
              href={`/admin/clientes/${encodeURIComponent(c.celular)}`}
              className="ml-auto text-xs text-cacao underline"
            >
              Abrir ficha completa →
            </Link>
          )}
        </div>

        <p className="mt-1 text-sm">
          <a href={wa} target="_blank" rel="noopener noreferrer" className="font-semibold text-verde-mielina underline">
            {c.celular}
          </a>
          {c.correo && <span className="text-cacao"> · {c.correo}</span>}
        </p>
        <p className="mt-0.5 text-xs text-cacao">
          Cliente desde {dia(c.creado)} · última visita {dia(c.ultima_visita)}
          {c.responsable && ` · atiende ${c.responsable}`}
        </p>

        {c.etiquetas.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {c.etiquetas.map((e) => (
              <span
                key={e}
                className="rounded-full bg-verde-mielina/25 px-2 py-0.5 text-[11px] font-bold text-[#3f5a1c]"
              >
                {e}
              </span>
            ))}
          </div>
        )}

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
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          { t: "Gastado", v: dinero(f.resumen.gastado), n: `${f.resumen.pagados} pagados` },
          { t: "Ticket promedio", v: dinero(f.resumen.ticket) },
          {
            t: "Pedidos",
            v: String(f.resumen.pedidos),
            n: f.resumen.pendientes > 0 ? `${f.resumen.pendientes} por cobrar` : undefined,
          },
          { t: "Último pedido", v: dia(f.resumen.ultimo_pedido) },
        ].map((k) => (
          <div key={k.t} className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-2.5">
            <p className="text-[10px] uppercase tracking-wide text-cacao">{k.t}</p>
            <p className="font-producto text-lg font-bold text-texto">{k.v}</p>
            {k.n && <p className="text-[10px] text-cacao">{k.n}</p>}
          </div>
        ))}
      </div>

      <div className={compacta ? "space-y-4" : "grid gap-4 md:grid-cols-2"}>
        <div className="space-y-4">
          <Seguimiento
            celular={c.celular}
            fecha={c.proximo_seguimiento}
            nota={c.seguimiento_nota}
            etapa={c.etapa}
            etapaManual={c.etapa_manual}
            hoy={f.hoy}
          />

          <section className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
            <h2 className="mb-2 font-titulo text-coral">Escribirle</h2>
            <EnviarMensaje celular={c.celular} correo={c.correo} nombre={c.nombre ?? ""} />
          </section>

          <section className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
            <h2 className="mb-2 font-titulo text-coral">Nota privada</h2>
            <form action={guardarNota} className="space-y-2">
              <input type="hidden" name="celular" value={c.celular} />
              <textarea
                name="nota"
                rows={3}
                defaultValue={c.nota ?? ""}
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
              <input type="hidden" name="celular" value={c.celular} />
              <input
                name="etiquetas"
                defaultValue={c.etiquetas.join(", ")}
                placeholder="mayorista, frecuente, Juárez"
                className="w-full rounded-lg border border-miel-borde bg-crema/40 px-2 py-1.5 text-sm"
              />
              <p className="text-[11px] text-cacao">Sepáralas con comas. Sirven para filtrar la lista.</p>
              <button className="rounded-full bg-durazno px-3 py-1 text-sm font-bold text-white">
                Guardar etiquetas
              </button>
            </form>

            <form action={alternarNoMolestar} className="mt-3 border-t border-miel-borde pt-3">
              <input type="hidden" name="celular" value={c.celular} />
              <input type="hidden" name="valor" value={c.no_molestar ? "0" : "1"} />
              <button className="rounded-full border border-miel-borde px-3 py-1 text-xs font-semibold text-cacao">
                {c.no_molestar ? "Quitar “no molestar”" : "Marcar “no molestar”"}
              </button>
            </form>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
            <h2 className="mb-2 font-titulo text-coral">Pedidos</h2>
            {f.pedidos.length === 0 ? (
              <p className="text-sm text-cacao">Todavía no ha hecho ningún pedido.</p>
            ) : (
              <ul className="divide-y divide-miel-borde text-sm">
                {f.pedidos.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2 py-1.5">
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
                    <span className="text-xs text-cacao">{dia(p.creado)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {f.conversaciones.length > 0 && (
            <section className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
              <h2 className="mb-2 font-titulo text-coral">Chats con el agente</h2>
              <ul className="space-y-1 text-sm">
                {f.conversaciones.map((v) => (
                  <li key={v.id}>
                    <Link href={`/admin/conversaciones?c=${v.id}`} className="text-texto underline hover:text-coral">
                      {v.canal ?? "chat"} · {v.estado}
                    </Link>
                    <span className="ml-2 text-xs text-cacao">{cuando(v.ultimo)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Un solo hilo: pedidos, solicitudes, mensajes, chats y actividad */}
          <section className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
            <h2 className="mb-2 font-titulo text-coral">Toda su historia</h2>
            {f.linea_tiempo.length === 0 ? (
              <p className="text-sm text-cacao">Sin actividad registrada.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {f.linea_tiempo.map((t, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="shrink-0">{ICONO_TIEMPO[t.clase] ?? "•"}</span>
                    <span className="min-w-0 text-texto">
                      {t.clase === "evento" ? (
                        <>
                          {ACTIVIDAD[t.titulo] ?? t.titulo}{" "}
                          {t.detalle && <strong>{t.detalle}</strong>}
                        </>
                      ) : (
                        <>
                          {t.titulo}
                          {t.detalle && <span className="text-cacao"> · {t.detalle}</span>}
                        </>
                      )}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-cacao">{cuando(t.hora)}</span>
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
