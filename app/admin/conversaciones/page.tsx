import Link from "next/link";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SelectorTiendaNav } from "../SelectorTiendaNav";
import { CanalIcono, CANAL_NOMBRE } from "./canal";

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
  abierta: { txt: "🤖 Agente", cls: "bg-verde-mielina/15 text-emerald-800" },
  en_humano: { txt: "🙋 Necesita humano", cls: "bg-durazno/15 text-durazno" },
  cerrada: { txt: "Cerrada", cls: "bg-cacao/20 text-cacao" },
};

function fecha(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

/** Tarjeta de una conversación en la bandeja. `urgente` la resalta (handoff). */
function Tarjeta({
  c,
  preview,
  urgente = false,
}: {
  c: Conv;
  preview?: string;
  urgente?: boolean;
}) {
  const est = ESTADO[c.estado];
  return (
    <Link
      href={`/admin/conversaciones/${c.id}`}
      className={`flex items-center gap-3 rounded-[var(--radius-marca)] border bg-white p-3 transition hover:bg-miel/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-durazno/50 focus-visible:ring-offset-2 ${
        urgente ? "border-l-4 border-durazno/60" : "border-miel-borde"
      }`}
    >
      <CanalIcono canal={c.tipo_canal} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-texto">
            {c.cliente_nombre || c.cliente_externo_id}
          </span>
          <span className="hidden shrink-0 text-[11px] text-cacao sm:inline">
            {CANAL_NOMBRE[c.tipo_canal ?? ""] ?? c.tipo_canal}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-1 text-sm text-cacao">{preview ?? "—"}</p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1 text-right">
        <span className="text-[11px] text-cacao">{fecha(c.ultimo_mensaje_en)}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${urgente ? "bg-durazno text-white" : est.cls}`}>
          {urgente ? "🙋 Te toca" : est.txt}
        </span>
      </div>
    </Link>
  );
}

export default async function ConversacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ tienda?: string }>;
}) {
  const perfil = await getPerfil();
  const esSuper = perfil?.rol === "superadmin";
  if (!perfil || (!esSuper && !perfil.tienda_id)) {
    return <p className="text-cacao">Esta sección es para administradores de una tienda.</p>;
  }
  const sp = await searchParams;
  const supabase = await createClient();

  // El superadmin elige qué tienda monitorear; el admin ve la suya.
  const t = esSuper ? (sp.tienda ?? "") : perfil.tienda_id!;
  const tiendas = esSuper
    ? ((await supabase.from("tiendas").select("id, nombre, slug").order("nombre")).data ?? [])
    : [];

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

  // Sección dedicada: las que necesitan atención humana van arriba, separadas
  // del resto; así la dueña ve primero lo que "le toca" responder.
  const pendientes = convs.filter((c) => c.estado === "en_humano");
  const resto = convs.filter((c) => c.estado !== "en_humano");

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="font-titulo text-2xl text-durazno">Conversaciones</h1>
        <p className="text-sm text-cacao">
          Todos los chats del agente con clientes. Las que necesitan que <strong>tú</strong>{" "}
          respondas aparecen arriba: ábrelas y toca <strong>Tomar control</strong>.
        </p>
        {esSuper && <SelectorTiendaNav tiendas={tiendas} actual={t} base="/admin/conversaciones" />}
      </div>

      {convs.length === 0 && (
        <p className="rounded-xl bg-miel/40 p-4 text-sm text-cacao">
          Aún no hay conversaciones. Cuando un cliente escriba al agente, aparecerán aquí.
        </p>
      )}

      {/* === Sección: necesitan atención humana === */}
      {pendientes.length > 0 && (
        <section className="space-y-2 rounded-[var(--radius-marca)] border border-durazno/40 bg-durazno/[0.06] p-3">
          <div className="flex items-center gap-2 px-1">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-durazno text-xs font-bold text-white">
              {pendientes.length}
            </span>
            <h2 className="font-titulo text-base text-durazno">
              {pendientes.length === 1 ? "Necesita atención humana" : "Necesitan atención humana"}
            </h2>
            <span className="ml-auto text-[11px] text-cacao">Te toca responder</span>
          </div>
          <div className="space-y-2">
            {pendientes.map((c) => (
              <Tarjeta key={c.id} c={c} preview={preview.get(c.id)} urgente />
            ))}
          </div>
        </section>
      )}

      {/* === Sección: el resto (agente / cerradas) === */}
      {resto.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 font-titulo text-base text-cacao">
            {pendientes.length > 0 ? "Todas las demás" : "Todas las conversaciones"}
          </h2>
          <div className="space-y-2">
            {resto.map((c) => (
              <Tarjeta key={c.id} c={c} preview={preview.get(c.id)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
