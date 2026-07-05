import type { Metadata } from "next";
import Link from "next/link";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cerrarSesion } from "./actions";
import { AvisoSuscripcion } from "./AvisoSuscripcion";

// Metadatos NEUTROS del panel: sobreescriben los del layout raíz (que son de la
// tienda Mamielina) para que el admin no muestre marca de cliente. No indexar.
export const metadata: Metadata = {
  title: "MyelPlay Agentes",
  description: "Panel del agente de ventas IA — MyelPlay Agentes.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "MyelPlay Agentes",
    siteName: "MyelPlay Agentes",
    description: "Panel del agente de ventas IA.",
  },
  twitter: {
    title: "MyelPlay Agentes",
    description: "Panel del agente de ventas IA.",
  },
};

type Item = { href: string; nombre: string; icon: string; lista?: boolean };
type Grupo = { grupo: string; items: Item[] };

// Navegación del SUPERADMIN (operador del SaaS: gestiona todas las tiendas).
const NAV_SUPER: Grupo[] = [
  {
    grupo: "General",
    items: [
      { href: "/admin", nombre: "Inicio", icon: "🏠" },
      { href: "/admin/tiendas", nombre: "Tiendas", icon: "🏪" },
    ],
  },
  {
    grupo: "Agente",
    items: [
      { href: "/admin/agente/alta", nombre: "Alta / Config", icon: "⚙️" },
      { href: "/admin/conversaciones", nombre: "Conversaciones", icon: "💬" },
      { href: "/admin/agente", nombre: "Métricas", icon: "📊" },
    ],
  },
];

// Navegación del ADMIN/DELEGADO de una tienda.
const NAV_TIENDA: Grupo[] = [
  {
    grupo: "General",
    items: [
      { href: "/admin", nombre: "Inicio", icon: "🏠" },
      { href: "/admin/vista", nombre: "Vista cliente", icon: "👁️" },
    ],
  },
  {
    grupo: "Catálogo",
    items: [
      { href: "/admin/nidos", nombre: "Nidos", icon: "🪺" },
      { href: "/admin/productos", nombre: "Productos", icon: "📦" },
      { href: "/admin/tallas", nombre: "Guía de tallas", icon: "📏" },
      { href: "/admin/apariencia", nombre: "Apariencia", icon: "🎨" },
      { href: "/admin/configuracion", nombre: "Configuración", icon: "⚙️" },
    ],
  },
  {
    grupo: "Agente",
    items: [
      { href: "/admin/conversaciones", nombre: "Conversaciones", icon: "💬" },
      { href: "/admin/agente", nombre: "Métricas", icon: "📊" },
      { href: "/admin/agente/alta", nombre: "Alta / Config agente", icon: "➕" },
    ],
  },
  {
    grupo: "Clientes",
    items: [
      { href: "/admin/pedidos", nombre: "Pedidos", icon: "🧾" },
      { href: "/admin/clientes", nombre: "Clientes", icon: "👥" },
      { href: "/admin/avisos", nombre: "Avisos", icon: "🔔" },
      { href: "/admin/identificar", nombre: "Identificar (IA)", icon: "🔎" },
      { href: "/admin/finanzas", nombre: "Finanzas", icon: "📈", lista: false },
    ],
  },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await getPerfil();

  // Sin sesión: deja pasar (es la página de login; el proxy protege el resto).
  if (!perfil) return <>{children}</>;

  const esSuper = perfil.rol === "superadmin";
  let grupos = esSuper ? NAV_SUPER : NAV_TIENDA;

  // Modo "solo catálogo": el agente es un add-on. Si la tienda no tiene alta
  // de agente (fila en agente_config, la crea el operador al contratarlo),
  // el panel no muestra los módulos del agente. El superadmin siempre los ve.
  if (!esSuper) {
    let tieneAgente = false;
    if (perfil.tienda_id) {
      const supabase = await createClient();
      const { data } = await supabase
        .from("agente_config")
        .select("tienda_id")
        .eq("tienda_id", perfil.tienda_id)
        .maybeSingle();
      tieneAgente = Boolean(data);
    }
    if (!tieneAgente) grupos = grupos.filter((g) => g.grupo !== "Agente");
  }

  return (
    <div className="admin-shell flex min-h-screen flex-col bg-slate-100 md:flex-row">
      {/* Sidebar oscuro */}
      <aside className="flex shrink-0 flex-col gap-1 bg-slate-900 p-3 text-slate-300 md:w-64 md:p-4">
        <Link href="/admin" className="mb-2 flex items-center gap-2.5 px-1.5 py-1">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-600 text-xs font-black tracking-tight text-white">
            MA
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-bold text-white">MyelPlay Agentes</span>
            <span className="block text-[11px] text-slate-400">
              {esSuper ? "Operador · Superadmin" : "Panel de tienda"}
            </span>
          </span>
        </Link>

        <nav className="flex flex-wrap gap-1 md:flex-col md:gap-0.5">
          {grupos.map((g) => (
            <div key={g.grupo} className="contents md:mt-4 md:block md:first:mt-1">
              <p className="hidden px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 md:block">
                {g.grupo}
              </p>
              {g.items.map((s) =>
                s.lista === false ? (
                  <span
                    key={s.href}
                    title="Próximamente"
                    className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600"
                  >
                    <span className="w-5 text-center">{s.icon}</span>
                    {s.nombre}
                  </span>
                ) : (
                  <Link
                    key={s.href}
                    href={s.href}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                  >
                    <span className="w-5 text-center">{s.icon}</span>
                    {s.nombre}
                  </Link>
                ),
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <span className="text-sm text-slate-500">
            Hola, <strong className="text-slate-800">{perfil.nombre}</strong>
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {perfil.rol}
            </span>
          </span>
          <form action={cerrarSesion}>
            <button className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">
              Salir
            </button>
          </form>
        </header>
        <main className="flex-1 p-5 md:p-8">
          {!esSuper && perfil.tienda_id && (
            <AvisoSuscripcion tiendaId={perfil.tienda_id} />
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
