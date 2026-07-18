"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Mensaje = {
  id: string;
  rol: "cliente" | "agente" | "humano" | "sistema";
  contenido: string | null;
  creado: string;
};

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
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
        .select("id, rol, contenido, creado")
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

  async function enviar() {
    const limpio = texto.trim();
    if (!limpio || enviando) return;
    setEnviando(true);
    const { data, error } = await supabase
      .from("agente_mensajes")
      .insert({ conversacion_id: conversacionId, tienda_id: tiendaId, rol: "humano", contenido: limpio })
      .select("id, rol, contenido, creado")
      .single();
    if (!error && data) {
      setMensajes((prev) => [...prev, data as Mensaje]);
      setTexto("");
      await supabase
        .from("agente_conversaciones")
        .update({ ultimo_mensaje_en: new Date().toISOString() })
        .eq("id", conversacionId)
        .eq("tienda_id", tiendaId);
    } else if (error) {
      alert("No se pudo enviar: " + error.message);
    }
    setEnviando(false);
  }

  return (
    <div className="flex flex-col">
      <div className="max-h-[55vh] space-y-2 overflow-y-auto rounded-[var(--radius-marca)] border border-miel-borde bg-crema/40 p-4">
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
          return (
            <div key={m.id} className={`flex ${esCliente ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${burbuja}`}>
                {!esCliente && (
                  <span className="mb-0.5 block text-[10px] font-bold uppercase opacity-60">
                    {m.rol === "humano" ? "Equipo" : "Agente"}
                  </span>
                )}
                <span className="whitespace-pre-wrap">{m.contenido}</span>
                <span className="mt-0.5 block text-right text-[10px] opacity-50">{hora(m.creado)}</span>
              </div>
            </div>
          );
        })}
        <div ref={finRef} />
      </div>

      {/* Caja de respuesta pegada abajo (en móvil, responder sin hacer scroll). */}
      <div className="sticky bottom-0 z-10 mt-3 bg-crema/95 pb-1 pt-2 backdrop-blur supports-[backdrop-filter]:bg-crema/80">
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
