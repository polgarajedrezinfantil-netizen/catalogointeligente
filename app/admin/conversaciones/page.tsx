import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SelectorTiendaNav } from "../SelectorTiendaNav";
import { AutoRefrescar } from "./AutoRefrescar";
import { ListaChats, type ConvLista } from "./ListaChats";
import { PanelConversacion } from "./PanelConversacion";

export const dynamic = "force-dynamic";

export default async function ConversacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ tienda?: string; c?: string }>;
}) {
  const perfil = await getPerfil();
  const esSuper = perfil?.rol === "superadmin";
  if (!perfil || (!esSuper && !perfil.tienda_id)) {
    return <p className="text-cacao">Esta sección es para administradores de una tienda.</p>;
  }
  const sp = await searchParams;
  const c = typeof sp.c === "string" && sp.c ? sp.c : null;
  const supabase = await createClient();

  // El superadmin elige qué tienda monitorear; el admin ve la suya.
  let t = esSuper ? (sp.tienda ?? "") : perfil.tienda_id!;
  const tiendas = esSuper
    ? ((await supabase.from("tiendas").select("id, nombre, slug").order("nombre")).data ?? [])
    : [];

  // Enlace directo del super a un chat sin ?tienda: deriva la tienda del chat.
  if (esSuper && !t && c) {
    const { data } = await supabase
      .from("agente_conversaciones")
      .select("tienda_id")
      .eq("id", c)
      .maybeSingle();
    if (data?.tienda_id) t = data.tienda_id as string;
  }

  if (esSuper && !t) {
    return (
      <div className="max-w-3xl space-y-4">
        <h1 className="font-titulo text-2xl text-durazno">Conversaciones</h1>
        <p className="text-sm text-cacao">Elige una tienda para ver sus conversaciones.</p>
        <SelectorTiendaNav tiendas={tiendas} actual="" base="/admin/conversaciones" />
      </div>
    );
  }

  const { data: convData } = await supabase
    .from("agente_conversaciones")
    .select("id, tipo_canal, cliente_externo_id, cliente_nombre, estado, ultimo_mensaje_en")
    .eq("tienda_id", t)
    .order("ultimo_mensaje_en", { ascending: false })
    .limit(100);
  const convs = (convData ?? []) as ConvLista[];

  // Vista previa: último mensaje por conversación (una sola consulta).
  const previews: Record<string, string> = {};
  if (convs.length) {
    const { data: msgs } = await supabase
      .from("agente_mensajes")
      .select("conversacion_id, contenido, rol, creado")
      .in("conversacion_id", convs.map((cv) => cv.id))
      .order("creado", { ascending: false })
      .limit(600);
    for (const m of msgs ?? []) {
      if (!m.contenido) continue;
      const cid = m.conversacion_id as string;
      if (!(cid in previews)) {
        const pre = m.rol === "cliente" ? "" : m.rol === "humano" ? "👤 " : m.rol === "sistema" ? "• " : "🤖 ";
        previews[cid] = pre + (m.contenido as string);
      }
    }
  }

  const tiendaParam = esSuper ? t : null;
  const listaHref = tiendaParam
    ? `/admin/conversaciones?tienda=${tiendaParam}`
    : "/admin/conversaciones";
  const alturaPane = "h-[calc(100dvh-11rem)] md:h-[calc(100vh-9.5rem)]";

  return (
    <div className="flex flex-col gap-3">
      {/* Refresca la bandeja en vivo (nuevas escaladas aparecen solas). */}
      <AutoRefrescar segundos={10} />

      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="font-titulo text-2xl text-durazno">Conversaciones</h1>
        <span className="inline-flex items-center gap-1 rounded-full bg-verde-mielina/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
          <span className="h-1.5 w-1.5 rounded-full bg-verde-mielina" />
          En vivo
        </span>
        {esSuper && (
          <div className="ml-auto">
            <SelectorTiendaNav tiendas={tiendas} actual={t} base="/admin/conversaciones" />
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {/* Izquierda: lista de chats (en móvil se oculta al abrir un chat) */}
        <div className={`${alturaPane} min-h-0 ${c ? "hidden md:block" : "block"}`}>
          <ListaChats convs={convs} previews={previews} selected={c} tienda={tiendaParam} />
        </div>

        {/* Derecha: la conversación (o el marcador de posición) */}
        <div className={`${alturaPane} min-h-0 ${c ? "block" : "hidden md:block"}`}>
          {c ? (
            <PanelConversacion
              id={c}
              esSuper={esSuper}
              tiendaAdmin={perfil.tienda_id ?? null}
              volverHref={listaHref}
            />
          ) : (
            <div className="grid h-full place-items-center rounded-[var(--radius-marca)] border border-dashed border-miel-borde bg-white/60 p-6 text-center text-sm text-cacao">
              Selecciona una conversación para verla aquí.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
