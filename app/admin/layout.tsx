import type { Metadata } from "next";
import Link from "next/link";
import { getPerfil } from "@/lib/auth";
import { cerrarSesion } from "./actions";
import { LogoMamielina } from "@/components/marca/Elementos";

// Etiqueta de la pestaña del navegador en todo el panel.
export const metadata: Metadata = {
  title: "Panel de administración",
};

// Navegación del SUPERADMIN (gestiona todas las tiendas del SaaS).
const NAV_SUPER = [
  { href: "/admin", nombre: "Inicio", lista: true },
  { href: "/admin/tiendas", nombre: "Tiendas", lista: true },
];

// Navegación del ADMIN/DELEGADO de una tienda. Se activan por fase.
const NAV_TIENDA = [
  { href: "/admin", nombre: "Inicio", lista: true },
  { href: "/admin/vista", nombre: "👁️ Vista cliente", lista: true },
  { href: "/admin/configuracion", nombre: "Configuración", lista: true },
  { href: "/admin/apariencia", nombre: "Apariencia", lista: true },
  { href: "/admin/nidos", nombre: "Nidos", lista: true },
  { href: "/admin/productos", nombre: "Productos", lista: true },
  { href: "/admin/tallas", nombre: "📏 Guía de tallas", lista: true },
  { href: "/admin/pedidos", nombre: "🧾 Pedidos", lista: true },
  { href: "/admin/conversaciones", nombre: "💬 Conversaciones", lista: true },
  { href: "/admin/agente", nombre: "📊 Métricas del agente", lista: true },
  { href: "/admin/agente/alta", nombre: "➕ Alta / Config agente", lista: true },
  { href: "/admin/identificar", nombre: "Identificar (IA)", lista: true },
  { href: "/admin/avisos", nombre: "Avisos", lista: true },
  { href: "/admin/clientes", nombre: "Clientes", lista: true },
  { href: "/admin/finanzas", nombre: "Finanzas", lista: false },
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
  const nav = esSuper ? NAV_SUPER : NAV_TIENDA;

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="border-b border-miel-borde bg-white p-4 md:w-60 md:border-b-0 md:border-r">
        <div className="mb-1 flex items-center justify-between">
          <LogoMamielina className="text-base" />
        </div>
        <p className="mb-4 font-mano text-lg text-cacao">
          {esSuper ? "Superadmin" : "Los Nidos"}
        </p>
        <nav className="flex flex-wrap gap-1 md:flex-col">
          {nav.map((s) =>
            s.lista ? (
              <Link
                key={s.href}
                href={s.href}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-texto hover:bg-miel/30"
              >
                {s.nombre}
              </Link>
            ) : (
              <span
                key={s.href}
                title="Próximamente"
                className="cursor-not-allowed rounded-xl px-3 py-2 text-sm font-semibold text-cacao/50"
              >
                {s.nombre}
              </span>
            ),
          )}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-miel-borde bg-crema px-5 py-3">
          <span className="text-sm text-cacao">
            Hola, <strong className="text-texto">{perfil.nombre}</strong>{" "}
            <span className="rounded-full bg-miel px-2 py-0.5 text-xs text-[#7a5a14]">
              {perfil.rol}
            </span>
          </span>
          <form action={cerrarSesion}>
            <button className="text-sm font-semibold text-durazno hover:underline">
              Salir
            </button>
          </form>
        </header>
        <div className="flex-1 p-5">{children}</div>
      </div>
    </div>
  );
}
