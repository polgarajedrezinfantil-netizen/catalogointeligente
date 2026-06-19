import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { marcarEnviado, marcarPendiente } from "./actions";

type Notif = {
  id: string;
  tipo: string;
  destino: string;
  celular: string | null;
  cuerpo: string;
  estado: string;
  meta: { cliente?: string; producto?: string } | null;
  creado: string;
};

const ETIQ: Record<string, { txt: string; cls: string }> = {
  turno: { txt: "Es tu turno", cls: "bg-verde-mielina text-white" },
  vence: { txt: "Por vencer", cls: "bg-sol text-[#7a5414]" },
  pregunta: { txt: "Pregunta", cls: "bg-durazno text-white" },
  carrito: { txt: "Carrito", cls: "bg-cacao text-white" },
};

function fecha(s: string) {
  return new Date(s).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Bandeja de avisos: lo que hay que comunicarle a un cliente por WhatsApp.
// Por defecto, un toque arma el wa.me prellenado a su número. Si activas la
// API de WhatsApp Business, estos envíos se vuelven automáticos.
export default async function AvisosPage() {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) {
    return <p className="text-cacao">Esta sección es para administradores de una tienda.</p>;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("notificaciones")
    .select("id, tipo, destino, celular, cuerpo, estado, meta, creado")
    .eq("tienda_id", perfil.tienda_id)
    .order("estado", { ascending: true }) // pendiente antes que enviado
    .order("creado", { ascending: false })
    .limit(100);
  const avisos = (data ?? []) as Notif[];
  const pendientes = avisos.filter((a) => a.estado === "pendiente");

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="font-titulo text-2xl text-durazno">Avisos</h1>
        {pendientes.length > 0 && (
          <span className="rounded-full bg-durazno px-2 py-0.5 text-sm font-bold text-white">
            {pendientes.length} por enviar
          </span>
        )}
      </div>
      <p className="text-sm text-cacao">
        Mensajes para tus clientes (turnos de la fila y preguntas de productos).
        Toca <strong>Enviar por WhatsApp</strong> para abrir el chat con el mensaje listo.
      </p>

      <div className="space-y-2">
        {avisos.map((a) => {
          // A quién se contacta y con qué texto.
          const esPregunta = a.tipo === "pregunta";
          const contacto = esPregunta ? a.meta?.cliente ?? "" : a.celular ?? "";
          const texto = esPregunta
            ? `Hola 🍯 Sobre tu pregunta de "${a.meta?.producto ?? "un producto"}": `
            : a.cuerpo;
          const wa = contacto
            ? `https://wa.me/${contacto.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`
            : null;

          return (
            <div
              key={a.id}
              className={`rounded-[var(--radius-marca)] border p-3 ${
                a.estado === "pendiente" ? "border-miel-borde bg-white" : "border-miel-borde/50 bg-crema/50"
              }`}
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${ETIQ[a.tipo]?.cls ?? "bg-cacao text-white"}`}>
                  {ETIQ[a.tipo]?.txt ?? a.tipo}
                </span>
                <span className="text-xs text-cacao">{fecha(a.creado)}</span>
                {a.estado === "enviado" && (
                  <span className="text-xs font-semibold text-[#3f5a1c]">✓ enviado</span>
                )}
                {contacto && <span className="ml-auto text-xs text-cacao">📱 {contacto}</span>}
              </div>

              {esPregunta ? (
                <p className="text-sm text-texto">
                  <strong>Pregunta:</strong> “{a.cuerpo}”
                  {a.meta?.producto && (
                    <span className="text-cacao"> · sobre {a.meta.producto}</span>
                  )}
                </p>
              ) : (
                <p className="text-sm text-texto">{a.cuerpo}</p>
              )}

              <div className="mt-2 flex items-center gap-2">
                {wa ? (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-verde-mielina px-4 py-1.5 text-sm font-bold text-white"
                  >
                    Enviar por WhatsApp
                  </a>
                ) : (
                  <span className="text-xs text-cacao">Sin número de contacto</span>
                )}
                {a.estado === "pendiente" ? (
                  <form action={marcarEnviado}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="rounded-full border border-miel-borde px-3 py-1.5 text-sm font-semibold text-cacao">
                      Marcar enviado
                    </button>
                  </form>
                ) : (
                  <form action={marcarPendiente}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="rounded-full border border-miel-borde px-3 py-1.5 text-sm font-semibold text-cacao">
                      Reabrir
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
        {avisos.length === 0 && (
          <p className="py-8 text-center text-cacao">
            Aún no hay avisos. Aparecerán cuando alguien avance en una fila o haga una pregunta.
          </p>
        )}
      </div>
    </div>
  );
}
