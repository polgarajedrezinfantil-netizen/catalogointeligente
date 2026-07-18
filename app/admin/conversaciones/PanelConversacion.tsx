import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Hilo, type Mensaje } from "./Hilo";
import { CanalIcono, CANAL_NOMBRE } from "./canal";
import { BotonEliminar } from "./BotonEliminar";
import {
  tomarControl,
  devolverAlAgente,
  cerrarConversacion,
  archivarConversacion,
  desarchivarConversacion,
  eliminarConversacion,
} from "./actions";

// Columna derecha: la conversación seleccionada. Encabezado con el switch de IA
// (encendida = responde el agente / apagada = respondes tú), teléfono accionable
// y el hilo en vivo. Se embebe en la bandeja de dos columnas y también sirve
// como render de la pantalla completa en móvil.
export async function PanelConversacion({
  id,
  esSuper,
  tiendaAdmin,
  volverHref,
}: {
  id: string;
  esSuper: boolean;
  tiendaAdmin: string | null;
  volverHref: string;
}) {
  const supabase = await createClient();

  // El admin solo ve conversaciones de su tienda (filtro explícito + RLS); el
  // superadmin ve cualquiera.
  let q = supabase
    .from("agente_conversaciones")
    .select("id, tienda_id, tipo_canal, cliente_externo_id, cliente_nombre, cliente_celular, estado, archivada")
    .eq("id", id);
  if (!esSuper) q = q.eq("tienda_id", tiendaAdmin!);
  const { data: conv } = await q.maybeSingle();

  if (!conv) {
    return (
      <div className="grid h-full place-items-center rounded-[var(--radius-marca)] border border-miel-borde bg-white p-6 text-center text-sm text-cacao">
        Conversación no encontrada.
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

  const estado = conv.estado as "abierta" | "en_humano" | "cerrada";
  const iaActiva = estado === "abierta"; // el agente responde
  const nombre = conv.cliente_nombre || conv.cliente_externo_id;
  const canalNombre = CANAL_NOMBRE[conv.tipo_canal ?? ""] ?? conv.tipo_canal;

  // Teléfono accionable: en WhatsApp el id externo ES el número internacional.
  const cel = conv.cliente_celular?.trim() || null;
  const waNum = (conv.tipo_canal === "whatsapp" ? conv.cliente_externo_id : "").replace(/\D/g, "");
  const telHref = waNum ? `https://wa.me/${waNum}` : cel ? `tel:${cel.replace(/[^\d+]/g, "")}` : null;

  return (
    <div className="flex h-full min-h-0 flex-col rounded-[var(--radius-marca)] border border-miel-borde bg-white">
      {/* Encabezado */}
      <header className="shrink-0 border-b border-miel-borde p-3">
        <Link href={volverHref} className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-durazno md:hidden">
          ← Chats
        </Link>
        <div className="flex items-start gap-2.5">
          <CanalIcono canal={conv.tipo_canal} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-titulo text-lg text-coral">{nombre}</p>
            <p className="text-xs text-cacao">
              {canalNombre} · {iaActiva ? "🤖 IA activa" : "🙋 IA en pausa · respondes tú"}
              {telHref && (
                <>
                  {" · "}
                  <a
                    href={telHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-durazno underline-offset-2 hover:underline"
                  >
                    {waNum ? "WhatsApp" : `Llamar: ${cel}`}
                  </a>
                </>
              )}
            </p>
          </div>

          {/* Switch de IA + cerrar */}
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <form action={iaActiva ? tomarControl : devolverAlAgente}>
              <input type="hidden" name="conversacion_id" value={conv.id} />
              <button
                type="submit"
                title={iaActiva ? "Apagar IA — respondes tú" : "Encender IA — responde el agente"}
                className="flex items-center gap-2 rounded-full border border-miel-borde bg-crema/60 px-2.5 py-1 text-xs font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-durazno/50"
              >
                <span className={iaActiva ? "text-emerald-700" : "text-cacao"}>
                  {iaActiva ? "IA encendida" : "IA apagada"}
                </span>
                <span
                  className={`relative h-5 w-9 rounded-full transition-colors ${
                    iaActiva ? "bg-verde-mielina" : "bg-cacao/40"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                      iaActiva ? "left-[18px]" : "left-0.5"
                    }`}
                  />
                </span>
              </button>
            </form>

            <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[11px] text-cacao">
              {estado !== "cerrada" ? (
                <form action={cerrarConversacion}>
                  <input type="hidden" name="conversacion_id" value={conv.id} />
                  <button className="font-semibold underline-offset-2 hover:underline">Cerrar chat</button>
                </form>
              ) : (
                <form action={devolverAlAgente}>
                  <input type="hidden" name="conversacion_id" value={conv.id} />
                  <button className="font-semibold text-durazno underline-offset-2 hover:underline">Reabrir</button>
                </form>
              )}

              {conv.archivada ? (
                <form action={desarchivarConversacion}>
                  <input type="hidden" name="conversacion_id" value={conv.id} />
                  <input type="hidden" name="volver" value={volverHref} />
                  <button className="font-semibold text-durazno underline-offset-2 hover:underline">Desarchivar</button>
                </form>
              ) : (
                <form action={archivarConversacion}>
                  <input type="hidden" name="conversacion_id" value={conv.id} />
                  <input type="hidden" name="volver" value={volverHref} />
                  <button className="font-semibold underline-offset-2 hover:underline">🗄 Archivar</button>
                </form>
              )}

              <BotonEliminar action={eliminarConversacion} id={conv.id} volver={volverHref} />
            </div>
          </div>
        </div>
      </header>

      {/* Hilo (llena el resto y trae su propia caja de respuesta abajo) */}
      <div className="min-h-0 flex-1 p-3">
        <Hilo conversacionId={conv.id} tiendaId={conv.tienda_id} estado={estado} initial={mensajes} />
      </div>
    </div>
  );
}
