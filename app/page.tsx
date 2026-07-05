import Link from "next/link";
import { redirect } from "next/navigation";
import { tiendaPorHost } from "@/lib/marca-host";

// Portada por host:
// - <tienda>.myelplay.com  → directo al catálogo de esa tienda.
// - agentes.* / localhost / dominios técnicos → landing del PRODUCTO
//   (MyelPlay Agentes), neutra y sin marca de ningún cliente.
export default async function Home() {
  const tienda = await tiendaPorHost();
  if (tienda) redirect(`/${tienda.slug}`);

  return <LandingProducto />;
}

const PILARES = [
  {
    icon: "🏪",
    titulo: "Tu catálogo, tu marca",
    texto:
      "Catálogo en línea con tu logo, tus colores y tu propio subdominio. Tus clientas ven tu tienda, no una plataforma.",
  },
  {
    icon: "🧾",
    titulo: "Apartados y pedidos sin enredos",
    texto:
      "Apartado en vivo, pedidos con folio y resumen directo a tu WhatsApp. Tú confirmas el pago desde el panel.",
  },
  {
    icon: "🤖",
    titulo: "Agente de ventas IA (opcional)",
    texto:
      "Un asistente que atiende WhatsApp, Messenger e Instagram 24/7: responde con tu catálogo real y cobra con Mercado Pago.",
  },
];

function LandingProducto() {
  return (
    <main className="admin-shell flex min-h-screen flex-1 flex-col items-center justify-center gap-10 bg-slate-100 px-6 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-600 text-sm font-black tracking-tight text-white">
            MA
          </span>
          <span className="text-2xl font-bold text-slate-800">MyelPlay Agentes</span>
        </div>
        <h1 className="max-w-xl text-balance text-3xl font-bold text-slate-900">
          El catálogo en línea que atiende y vende por ti
        </h1>
        <p className="max-w-lg text-slate-600">
          Catálogo digital con tu marca, apartados en vivo y pedidos por
          WhatsApp — con un agente de ventas IA opcional para tus redes.
        </p>
      </div>

      <div className="grid w-full max-w-4xl gap-4 sm:grid-cols-3">
        {PILARES.map((p) => (
          <div
            key={p.titulo}
            className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm"
          >
            <span className="text-2xl">{p.icon}</span>
            <h2 className="mt-2 font-bold text-slate-800">{p.titulo}</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{p.texto}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/registro"
          className="rounded-full bg-indigo-600 px-6 py-3 font-bold text-white shadow-sm transition hover:bg-indigo-500"
        >
          Prueba gratis 14 días
        </Link>
        <a
          href="mailto:notificaciones@myelplay.com?subject=Quiero%20mi%20tienda%20en%20MyelPlay%20Agentes"
          className="rounded-full border border-slate-300 bg-white px-6 py-3 font-bold text-slate-700 transition hover:bg-slate-50"
        >
          Hablar con nosotros
        </a>
        <Link
          href="/admin"
          className="rounded-full border border-slate-300 bg-white px-6 py-3 font-bold text-slate-700 transition hover:bg-slate-50"
        >
          Entrar al panel
        </Link>
      </div>

      <footer className="flex gap-5 text-xs text-slate-400">
        <Link href="/privacidad" className="hover:text-slate-600">
          Aviso de privacidad
        </Link>
        <Link href="/eliminar-datos" className="hover:text-slate-600">
          Eliminación de datos
        </Link>
      </footer>
    </main>
  );
}
