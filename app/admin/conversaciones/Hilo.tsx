"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { decidirComprobante } from "./actions";

export type Adjunto = { tipo?: string; url: string; mime?: string };

export type Mensaje = {
  id: string;
  rol: "cliente" | "agente" | "humano" | "sistema";
  contenido: string | null;
  creado: string;
  adjuntos?: Adjunto[] | null;
  meta?: Record<string, unknown> | null;
};

// Columnas que trae el hilo (incluye media y meta para imágenes/comprobantes).
const COLS = "id, rol, contenido, creado, adjuntos, meta";

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function esPlaceholderImagen(texto: string | null) {
  return /^\[El cliente envió (una imagen|un adjunto)/.test(texto ?? "");
}

// Hilo de mensajes en vivo (sondea cada 4s) + caja de respuesta del humano.
// El sondeo usa el cliente de navegador (sesión del admin, respeta RLS).
export function Hilo({
  conversacionId,
  tiendaId,
  estado,
  initial,
}: {
  conversacionId: string;
  tiendaId: string;
  estado: "abierta" | "en_humano" | "cerrada";
  initial: Mensaje[];
}) {
  const [mensajes, setMensajes] = useState<Mensaje[]>(initial);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [decidiendo, setDecidiendo] = useState<string | null>(null);
  const [correos, setCorreos] = useState<Record<string, string>>({}); // correo del recibo por mensaje
  const finRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Auto-scroll al final cuando llegan mensajes.
  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes.length]);

  // Sondeo: trae lo nuevo desde el último mensaje conocido.
  useEffect(() => {
    let vivo = true;
    const tick = async () => {
      const ultimo = mensajes[mensajes.length - 1]?.creado ?? "1970-01-01";
      const { data } = await supabase
        .from("agente_mensajes")
        .select(COLS)
        .eq("conversacion_id", conversacionId)
        .gt("creado", ultimo)
        .order("creado", { ascending: true });
      if (!vivo || !data?.length) return;
      setMensajes((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        const nuevos = (data as Mensaje[]).filter((m) => !ids.has(m.id));
        return nuevos.length ? [...prev, ...nuevos] : prev;
      });
    };
    const t = setInterval(tick, 4000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [conversacionId, mensajes, supabase]);

  async function tocaUltimoMensaje() {
    await supabase
      .from("agente_conversaciones")
      .update({ ultimo_mensaje_en: new Date().toISOString() })
      .eq("id", conversacionId)
      .eq("tienda_id", tiendaId);
  }

  async function enviar() {
    const limpio = texto.trim();
    if (!limpio || enviando) return;
    setEnviando(true);
    const { data, error } = await supabase
      .from("agente_mensajes")
      .insert({ conversacion_id: conversacionId, tienda_id: tiendaId, rol: "humano", contenido: limpio })
      .select(COLS)
      .single();
    if (!error && data) {
      setMensajes((prev) => [...prev, data as Mensaje]);
      setTexto("");
      await tocaUltimoMensaje();
    } else if (error) {
      alert("No se pudo enviar: " + error.message);
    }
    setEnviando(false);
  }

  // Aprobar / rechazar un comprobante: server action (marca el pedido pagado si
  // hay uno pendiente y deja nota en el hilo).
  async function decidir(m: Mensaje, decision: "aprobado" | "rechazado", correo?: string) {
    if (decidiendo) return;
    setDecidiendo(m.id);
    const res = await decidirComprobante(m.id, decision, correo);
    if (!res?.ok) {
      alert("No se pudo procesar: " + (res?.error ?? "error"));
      setDecidiendo(null);
      return;
    }
    setMensajes((prev) => {
      const upd = prev.map((x) =>
        x.id === m.id
          ? { ...x, meta: { ...(x.meta ?? {}), comprobante: true, comprobante_estado: decision } }
          : x,
      );
      if (res.nota && !upd.some((x) => x.id === res.nota!.id)) upd.push(res.nota as Mensaje);
      return upd;
    });
    setDecidiendo(null);
  }

  // Marcar manualmente una imagen como comprobante (si el detector la omitió),
  // para que aparezcan los botones Aprobar/Rechazar.
  async function marcarComprobante(m: Mensaje) {
    const nuevoMeta = { ...(m.meta ?? {}), comprobante: true };
    const { error } = await supabase.from("agente_mensajes").update({ meta: nuevoMeta }).eq("id", m.id);
    if (error) {
      alert("No se pudo marcar: " + error.message);
      return;
    }
    setMensajes((prev) => prev.map((x) => (x.id === m.id ? { ...x, meta: nuevoMeta } : x)));
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-[var(--radius-marca)] border border-miel-borde bg-crema/40 p-4">
        {mensajes.length === 0 && (
          <p className="text-center text-sm text-cacao">Sin mensajes todavía.</p>
        )}
        {mensajes.map((m) => {
          if (m.rol === "sistema") {
            return (
              <p key={m.id} className="my-1 text-center text-xs italic text-cacao">
                {m.contenido}
              </p>
            );
          }
          const esCliente = m.rol === "cliente";
          const burbuja = esCliente
            ? "bg-white text-texto"
            : m.rol === "humano"
              ? "bg-durazno/15 text-durazno"
              : "bg-verde-mielina/15 text-emerald-800";

          const imgs = (m.adjuntos ?? []).filter(
            (a): a is Adjunto => !!a?.url && (a.tipo === "imagen" || (a.mime ?? "").startsWith("image")),
          );
          const textoVisible = imgs.length && esPlaceholderImagen(m.contenido) ? "" : m.contenido ?? "";
          const meta = (m.meta ?? {}) as { comprobante?: boolean; comprobante_estado?: string };

          return (
            <div key={m.id} className={`flex ${esCliente ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${burbuja}`}>
                {!esCliente && (
                  <span className="mb-0.5 block text-[10px] font-bold uppercase opacity-60">
                    {m.rol === "humano" ? "Equipo" : "Agente"}
                  </span>
                )}

                {imgs.map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="mb-1 block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.url}
                      alt="Imagen enviada por el cliente"
                      loading="lazy"
                      className="max-h-56 w-auto max-w-full rounded-lg border border-miel-borde object-contain"
                    />
                  </a>
                ))}

                {textoVisible && <span className="whitespace-pre-wrap">{textoVisible}</span>}

                {/* Comprobante de pago: aprobar / rechazar (pequeño y discreto) */}
                {esCliente && meta.comprobante && (
                  meta.comprobante_estado ? (
                    <span
                      className={`mt-1 block text-[11px] font-bold ${
                        meta.comprobante_estado === "aprobado" ? "text-emerald-700" : "text-coral"
                      }`}
                    >
                      {meta.comprobante_estado === "aprobado" ? "✅ Comprobante aprobado" : "❌ Comprobante rechazado"}
                    </span>
                  ) : (
                    <div className="mt-1.5 space-y-1">
                      <p className="text-[10px] font-semibold text-cacao">Comprobante de pago</p>
                      <input
                        type="email"
                        inputMode="email"
                        value={correos[m.id] ?? ""}
                        onChange={(e) => setCorreos((c) => ({ ...c, [m.id]: e.target.value }))}
                        placeholder="Correo para el recibo (opcional)"
                        className="w-full rounded-lg border border-miel-borde bg-white px-2 py-1 text-[11px] text-texto placeholder:text-cacao/70 focus:outline-none focus:ring-2 focus:ring-durazno/40"
                      />
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => decidir(m, "aprobado", correos[m.id])}
                          disabled={decidiendo === m.id}
                          className="rounded-full bg-verde-mielina px-2.5 py-0.5 text-[11px] font-bold text-white disabled:opacity-50"
                        >
                          {decidiendo === m.id ? "…" : "Aprobar"}
                        </button>
                        <button
                          onClick={() => decidir(m, "rechazado")}
                          disabled={decidiendo === m.id}
                          className="rounded-full bg-coral px-2.5 py-0.5 text-[11px] font-bold text-white disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      </div>
                    </div>
                  )
                )}

                {/* Marcar manualmente como comprobante (si el detector la omitió) */}
                {esCliente && imgs.length > 0 && !meta.comprobante && !meta.comprobante_estado && (
                  <button
                    onClick={() => marcarComprobante(m)}
                    className="mt-1 block text-[10px] font-semibold text-cacao underline underline-offset-2 hover:text-durazno"
                  >
                    Marcar como comprobante
                  </button>
                )}

                <span className="mt-0.5 block text-right text-[10px] opacity-50">{hora(m.creado)}</span>
              </div>
            </div>
          );
        })}
        <div ref={finRef} />
      </div>

      {/* Caja de respuesta (queda abajo del hilo, en la base del panel). */}
      <div className="mt-3 shrink-0">
        {estado === "en_humano" ? (
          <div className="flex gap-2">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              rows={2}
              placeholder="Escribe tu respuesta… (Enter para enviar)"
              className="flex-1 resize-none rounded-xl border border-miel-borde bg-white px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-durazno/40"
            />
            <button
              onClick={enviar}
              disabled={enviando || !texto.trim()}
              className="shrink-0 rounded-full bg-durazno px-5 py-2.5 text-sm font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-durazno/50 disabled:opacity-40"
            >
              {enviando ? "…" : "Enviar"}
            </button>
          </div>
        ) : (
          <p className="rounded-xl bg-miel/40 p-3 text-center text-xs text-cacao">
            {estado === "cerrada"
              ? "Conversación cerrada. Devuélvela al agente para reactivarla."
              : "El agente está atendiendo. Toca “Tomar control” para responder tú."}
          </p>
        )}
      </div>
    </div>
  );
}
