import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Aviso de privacidad — MyelPlay Agentes",
  description: "Aviso de privacidad del agente de ventas por WhatsApp, Instagram y Messenger.",
  robots: { index: true, follow: true },
};

const H = "mt-7 mb-2 text-lg font-bold text-slate-800";
const P = "mb-3 text-sm leading-relaxed text-slate-600";
const LI = "text-sm leading-relaxed text-slate-600";

export default function PrivacidadPage() {
  return (
    <main className="admin-shell min-h-screen bg-slate-100 px-6 py-12">
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-xs font-black text-white">
            MA
          </span>
          <span className="text-lg font-bold text-slate-800">MyelPlay Agentes</span>
        </div>

        <h1 className="text-2xl font-bold text-slate-900">Aviso de privacidad</h1>
        <p className="mt-1 text-xs text-slate-500">Última actualización: 29 de junio de 2026</p>

        <p className={`${P} mt-5`}>
          <strong>MyelPlay Agentes</strong>, operado por Alberto Jesús González Herrera, con
          domicilio en Ciudad Juárez, Chihuahua, México (el “Responsable”), es responsable del
          tratamiento de tus datos personales conforme a la Ley Federal de Protección de Datos
          Personales en Posesión de los Particulares. Contacto:{" "}
          <a className="font-semibold text-indigo-600" href="mailto:notificaciones@myelplay.com">
            notificaciones@myelplay.com
          </a>
          .
        </p>

        <h2 className={H}>¿Qué es este servicio?</h2>
        <p className={P}>
          MyelPlay Agentes es un asistente de ventas que responde, en nombre de tiendas que
          contratan el servicio, los mensajes que los clientes envían por WhatsApp, Instagram y
          Facebook Messenger.
        </p>

        <h2 className={H}>Datos que tratamos</h2>
        <ul className="mb-3 list-disc space-y-1 pl-5">
          <li className={LI}>Tu nombre de perfil e identificador del canal (número de WhatsApp, usuario de Instagram/Facebook).</li>
          <li className={LI}>El contenido de los mensajes que envías y recibes en la conversación.</li>
          <li className={LI}>Productos consultados y datos necesarios para tu pedido (p. ej. zona de envío).</li>
        </ul>

        <h2 className={H}>¿Para qué los usamos?</h2>
        <ul className="mb-3 list-disc space-y-1 pl-5">
          <li className={LI}>Atender tus consultas y darte información del catálogo.</li>
          <li className={LI}>Generar tu enlace de pago y dar seguimiento a tu pedido.</li>
          <li className={LI}>Transferir la conversación a una persona del equipo cuando se requiera.</li>
          <li className={LI}>Mejorar la calidad del servicio.</li>
        </ul>

        <h2 className={H}>Con quién los compartimos (encargados)</h2>
        <ul className="mb-3 list-disc space-y-1 pl-5">
          <li className={LI}><strong>Meta</strong> (WhatsApp, Instagram, Messenger) — entrega de los mensajes.</li>
          <li className={LI}><strong>Anthropic</strong> — modelo de inteligencia artificial que genera las respuestas.</li>
          <li className={LI}><strong>Mercado Pago</strong> — procesamiento de pagos.</li>
          <li className={LI}><strong>Supabase / Vercel</strong> — alojamiento y base de datos.</li>
        </ul>
        <p className={P}>
          No vendemos tus datos. Algunos proveedores pueden procesar la información en servidores
          fuera de México (p. ej. Estados Unidos).
        </p>

        <h2 className={H}>Conservación</h2>
        <p className={P}>
          Conservamos las conversaciones el tiempo necesario para dar el servicio y cumplir
          obligaciones legales; después se eliminan o anonimizan.
        </p>

        <h2 className={H}>Tus derechos (ARCO) y eliminación</h2>
        <p className={P}>
          Puedes solicitar acceder, rectificar, cancelar u oponerte al tratamiento de tus datos, y
          pedir su eliminación, escribiendo a{" "}
          <a className="font-semibold text-indigo-600" href="mailto:notificaciones@myelplay.com">
            notificaciones@myelplay.com
          </a>
          . Consulta también nuestras{" "}
          <Link className="font-semibold text-indigo-600" href="/eliminar-datos">
            instrucciones para eliminar tus datos
          </Link>
          .
        </p>

        <h2 className={H}>Cambios</h2>
        <p className={P}>
          Podemos actualizar este aviso; publicaremos la versión vigente en esta misma dirección.
        </p>
      </div>
    </main>
  );
}
