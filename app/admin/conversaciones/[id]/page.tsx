import Link from "next/link";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Hilo, type Mensaje } from "./Hilo";
import { tomarControl, devolverAlAgente, cerrarConversacion } from "../actions";

export const dynamic = "force-dynamic";

const CANAL: Record<string, string> = {
  simulacion: "🧪 Simulación",
  whatsapp: "WhatsApp",
  messenger: "Messenger",
  instagram: "Instagram",
};

const ESTADO = {
  abierta: { txt: "🤖 Agente", cls: "bg-verde-mielina/25 text-[#3f5a1c]" },
  en_humano: { txt: "🙋 En atención humana", cls: "bg-durazno/30 text-[#7a3a26]" },
  cerrada: { txt: "Cerrada", cls: "bg-cacao/20 text-cacao" },
} as const;

export default async function ConversacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const perfil = await getPerfil();
  const esSuper = perfil?.rol === "superadmin";
  if (!perfil || (!esSuper && !perfil.tienda_id)) {
    return <p className="text-cacao">Esta sección es para administradores de una tienda.</p>;
  }
  const supabase = await createClient();

  // El admin solo ve conversaciones de su tienda (RLS + filtro); el superadmin
  // ve cualquiera (carga por id; la RLS agente_conv_super lo permite).
  let q = supabase
    .from("agente_conversaciones")
    .select("id, tienda_id, tipo_canal, cliente_externo_id, cliente_nombre, cliente_celular, estado, asignado_a")
    .eq("id", id);
  if (!esSuper) q = q.eq("tienda_id", perfil.tienda_id!);
  const { data: conv } = await q.maybeSingle();

  if (!conv) {
    return (
      <div className="space-y-3">
        <p className="text-cacao">Conversación no encontrada.</p>
        <Link href="/admin/conversaciones" className="text-sm font-semibold text-durazno underline">
          ← Volver a la bandeja
        </Link>
      </div>
    );
  }

  const { data: msgsData } = await supabase
    .from("agente_mensajes")
    .select("id, rol, contenido, creado")
    .eq("conversacion_id", id)
    .order("creado", { ascending: true })
    .limit(500);
  const mensajes = (msgsData ?? []) as Mensaje[];

  const estado = conv.estado as keyof typeof ESTADO;
  const est = ESTADO[estado];

  return (
    <div className="max-w-2xl space-y-4">
      <Link
        href={esSuper ? `/admin/conversaciones?tienda=${conv.tienda_id}` : "/admin/conversaciones"}
        className="text-sm font-semibold text-durazno underline"
      >
        ← Bandeja
      </Link>

      <div className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-titulo text-xl text-coral">
            {conv.cliente_nombre || conv.cliente_externo_id}
          </span>
          <span className="text-xs text-cacao">{CANAL[conv.tipo_canal ?? ""] ?? conv.tipo_canal}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${est.cls}`}>{est.txt}</span>
        </div>
        {conv.cliente_celular && (
          <p className="mt-1 text-xs text-cacao">Cel: {conv.cliente_celular}</p>
        )}

        {/* Acciones de handoff */}
        <div className="mt-3 flex flex-wrap gap-2">
          {estado === "abierta" && (
            <form action={tomarControl}>
              <input type="hidden" name="conversacion_id" value={conv.id} />
              <button className="rounded-full bg-durazno px-4 py-2 text-sm font-bold text-white">
                🙋 Tomar control
              </button>
            </form>
          )}
          {(estado === "en_humano" || estado === "cerrada") && (
            <form action={devolverAlAgente}>
              <input type="hidden" name="conversacion_id" value={conv.id} />
              <button className="rounded-full bg-verde-mielina px-4 py-2 text-sm font-bold text-white">
                🤖 Devolver al agente
              </button>
            </form>
          )}
          {estado !== "cerrada" && (
            <form action={cerrarConversacion}>
              <input type="hidden" name="conversacion_id" value={conv.id} />
              <button className="rounded-full border border-cacao/40 px-4 py-2 text-sm font-bold text-cacao">
                Cerrar
              </button>
            </form>
          )}
        </div>
      </div>

      <Hilo conversacionId={conv.id} tiendaId={conv.tienda_id} estado={estado} initial={mensajes} />
    </div>
  );
}
