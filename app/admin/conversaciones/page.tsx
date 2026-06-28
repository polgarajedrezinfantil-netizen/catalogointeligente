import Link from "next/link";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Conv = {
  id: string;
  tipo_canal: string | null;
  cliente_externo_id: string;
  cliente_nombre: string | null;
  estado: "abierta" | "en_humano" | "cerrada";
  ultimo_mensaje_en: string;
};

const ESTADO: Record<Conv["estado"], { txt: string; cls: string }> = {
  abierta: { txt: "🤖 Agente", cls: "bg-verde-mielina/25 text-[#3f5a1c]" },
  en_humano: { txt: "🙋 Necesita humano", cls: "bg-durazno/30 text-[#7a3a26]" },
  cerrada: { txt: "Cerrada", cls: "bg-cacao/20 text-cacao" },
};

export const CANAL: Record<string, string> = {
  simulacion: "🧪 Simulación",
  whatsapp: "WhatsApp",
  messenger: "Messenger",
  instagram: "Instagram",
};

function fecha(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default async function ConversacionesPage() {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) {
    return <p className="text-cacao">Esta sección es para administradores de una tienda.</p>;
  }
  const t = perfil.tienda_id;
  const supabase = await createClient();

  const { data: convData } = await supabase
    .from("agente_conversaciones")
    .select("id, tipo_canal, cliente_externo_id, cliente_nombre, estado, ultimo_mensaje_en")
    .eq("tienda_id", t)
    .order("ultimo_mensaje_en", { ascending: false })
    .limit(100);
  const convs = (convData ?? []) as Conv[];

  // Vista previa: último mensaje por conversación (una sola consulta).
  const preview = new Map<string, string>();
  if (convs.length) {
    const { data: msgs } = await supabase
      .from("agente_mensajes")
      .select("conversacion_id, contenido, rol, creado")
      .in("conversacion_id", convs.map((c) => c.id))
      .order("creado", { ascending: false })
      .limit(600);
    for (const m of msgs ?? []) {
      if (!m.contenido) continue;
      if (!preview.has(m.conversacion_id as string)) {
        const pre = m.rol === "cliente" ? "" : m.rol === "humano" ? "👤 " : m.rol === "sistema" ? "• " : "🤖 ";
        preview.set(m.conversacion_id as string, pre + (m.contenido as string));
      }
    }
  }

  const pendientes = convs.filter((c) => c.estado === "en_humano").length;

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="font-titulo text-2xl text-durazno">Conversaciones</h1>
        <p className="text-sm text-cacao">
          Todos los chats del agente con clientes. Cuando el agente pasa una a un humano
          aparece marcada como <strong>Necesita humano</strong>: ábrela y toca <strong>Tomar
          control</strong> para responder tú.
        </p>
      </div>

      {pendientes > 0 && (
        <p className="rounded-xl bg-durazno/15 p-3 text-sm font-semibold text-[#7a3a26]">
          {pendientes} {pendientes === 1 ? "conversación necesita" : "conversaciones necesitan"} atención humana.
        </p>
      )}

      {convs.length === 0 && (
        <p className="rounded-xl bg-miel/30 p-4 text-sm text-[#7a5a14]">
          Aún no hay conversaciones. Cuando un cliente escriba al agente, aparecerán aquí.
        </p>
      )}

      <div className="space-y-2">
        {convs.map((c) => {
          const est = ESTADO[c.estado];
          return (
            <Link
              key={c.id}
              href={`/admin/conversaciones/${c.id}`}
              className={`block rounded-[var(--radius-marca)] border bg-white p-4 transition hover:bg-miel/10 ${
                c.estado === "en_humano" ? "border-durazno" : "border-miel-borde"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-texto">
                  {c.cliente_nombre || c.cliente_externo_id}
                </span>
                <span className="text-xs text-cacao">{CANAL[c.tipo_canal ?? ""] ?? c.tipo_canal}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${est.cls}`}>{est.txt}</span>
                <span className="ml-auto text-xs text-cacao">{fecha(c.ultimo_mensaje_en)}</span>
              </div>
              <p className="mt-1 line-clamp-1 text-sm text-cacao">
                {preview.get(c.id) ?? "—"}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
