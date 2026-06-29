import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Eliminar mis datos — MyelPlay Agentes",
  description: "Cómo solicitar la eliminación de tus datos en MyelPlay Agentes.",
  robots: { index: true, follow: true },
};

export default function EliminarDatosPage() {
  return (
    <main className="admin-shell min-h-screen bg-slate-100 px-6 py-12">
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-xs font-black text-white">
            MA
          </span>
          <span className="text-lg font-bold text-slate-800">MyelPlay Agentes</span>
        </div>

        <h1 className="text-2xl font-bold text-slate-900">Eliminar mis datos</h1>
        <p className="mt-1 text-xs text-slate-500">Última actualización: 29 de junio de 2026</p>

        <p className="mb-3 mt-5 text-sm leading-relaxed text-slate-600">
          Para solicitar la eliminación de tus datos personales (tu nombre de perfil, identificador
          del canal y el historial de tu conversación con el agente), tienes dos opciones:
        </p>

        <ol className="mb-4 list-decimal space-y-2 pl-5">
          <li className="text-sm leading-relaxed text-slate-600">
            Envía un mensaje al mismo chat (WhatsApp, Instagram o Messenger) con el texto{" "}
            <strong>“ELIMINAR MIS DATOS”</strong> y una persona del equipo procesará tu solicitud.
          </li>
          <li className="text-sm leading-relaxed text-slate-600">
            Escribe a{" "}
            <a className="font-semibold text-indigo-600" href="mailto:notificaciones@myelplay.com">
              notificaciones@myelplay.com
            </a>{" "}
            indicando el canal y el número/usuario desde el que escribiste.
          </li>
        </ol>

        <p className="mb-3 text-sm leading-relaxed text-slate-600">
          Eliminaremos tus datos en un plazo máximo de <strong>30 días</strong>, salvo la información
          que debamos conservar por obligaciones legales.
        </p>

        <p className="text-sm leading-relaxed text-slate-600">
          Más información en nuestro{" "}
          <Link className="font-semibold text-indigo-600" href="/privacidad">
            aviso de privacidad
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
