import Link from "next/link";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Hilo, type Mensaje } from "./Hilo";
import { tomarControl, devolverAlAgente, cerrarConversacion } from "../actions";
import { CanalIcono, CANAL_NOMBRE } from "../canal";

export const dynamic = "force-dynamic";

const ESTADO = {
  abierta: { txt: "🤖 Agente", cls: "bg-verde-mielina/15 text-emerald-800" },
  en_humano: { txt: "🙋 En atención humana", cls: "bg-durazno/15 text-durazno" },
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

  // Teléfono accionable: en WhatsApp el id externo ES el número internacional →
  // abre el chat en wa.me; en otros canales, un enlace tel: al celular guardado.
  const cel = conv.cliente_celular?.trim() || null;
  const waNum = (conv.tipo_canal === "whatsapp" ? conv.cliente_externo_id : "").replace(/\D/g, "");
  const telHref = waNum
    ? `https://wa.me/${waNum}`
    : cel
      ? `tel:${cel.replace(/[^\d+]/g, "")}`
      : null;

  return (
    <div className="max-w-2xl space-y-4">
      <Link
        href={esSuper ? `/admin/conversaciones?tienda=${conv.tienda_id}` : "/admin/conversaciones"}
        className="text-sm font-semibold text-durazno underline"
      >
        ← Bandeja
      </Link>

      <div className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <CanalIcono canal={conv.tipo_canal} size={38} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-titulo text-xl text-coral">
                {conv.cliente_nombre || conv.cliente_externo_id}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${est.cls}`}>{est.txt}</span>
            </div>
            <p className="text-xs text-cacao">
              {CANAL_NOMBRE[conv.tipo_canal ?? ""] ?? conv.tipo_canal}
              {(cel || waNum) && telHref && (
                <>
                  {" · "}
                  <a
                    href={telHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-durazno underline-offset-2 hover:underline"
                  >
                    {waNum ? "Escribir por WhatsApp" : `Llamar: ${cel}`}
                  </a>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Acciones de handoff */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {estado === "abierta" && (
            <form action={tomarControl} className="w-full sm:w-auto">
              <input type="hidden" name="conversacion_id" value={conv.id} />
              <button className="w-full rounded-full bg-durazno px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-durazno/50 focus-visible:ring-offset-2 sm:w-auto">
                🙋 Tomar control
              </button>
            </form>
          )}
          {(estado === "en_humano" || estado === "cerrada") && (
            <form action={devolverAlAgente} className="w-full sm:w-auto">
              <input type="hidden" name="conversacion_id" value={conv.id} />
              <button className="w-full rounded-full bg-verde-mielina px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-verde-mielina/50 focus-visible:ring-offset-2 sm:w-auto">
                🤖 Devolver al agente
              </button>
            </form>
          )}
          {estado !== "cerrada" && (
            <form action={cerrarConversacion} className="w-full sm:w-auto">
              <input type="hidden" name="conversacion_id" value={conv.id} />
              <button className="w-full rounded-full border border-cacao/40 px-4 py-2.5 text-sm font-bold text-cacao focus:outline-none focus-visible:ring-2 focus-visible:ring-cacao/40 focus-visible:ring-offset-2 sm:w-auto">
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
