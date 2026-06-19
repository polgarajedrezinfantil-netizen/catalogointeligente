import Link from "next/link";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Estrella } from "@/components/marca/Elementos";

// Inicio del panel. Distinto para superadmin y para admin de tienda.
export default async function AdminInicio() {
  const perfil = await getPerfil();
  if (!perfil) return null;

  if (perfil.rol === "superadmin") {
    const supabase = await createClient();
    const { count } = await supabase
      .from("tiendas")
      .select("id", { count: "exact", head: true });
    return (
      <div className="space-y-4">
        <h1 className="font-titulo text-2xl text-durazno">
          Panel de Superadmin
        </h1>
        <p className="text-cacao">
          Gestiona las tiendas del SaaS, asigna planes e invita a sus
          administradores.
        </p>
        <div className="flex items-center gap-3 rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
          <Estrella className="h-5 w-5 text-sol" />
          <p className="text-sm text-texto">
            Tiendas registradas: <strong>{count ?? 0}</strong>
          </p>
          <Link
            href="/admin/tiendas"
            className="ml-auto rounded-full bg-verde-mielina px-4 py-2 text-sm font-bold text-white"
          >
            Gestionar tiendas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="font-titulo text-2xl text-durazno">Panel de tu tienda</h1>
      <p className="text-cacao">
        Configura tus líneas y campos, arma tus Nidos y publica productos.
      </p>
      <div className="flex items-center gap-3 rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
        <Estrella className="h-5 w-5 text-sol" />
        <p className="text-sm text-texto">
          Empieza por la <strong>Configuración</strong>: define tus líneas de
          venta y sus campos.
        </p>
        <Link
          href="/admin/configuracion"
          className="ml-auto rounded-full bg-verde-mielina px-4 py-2 text-sm font-bold text-white"
        >
          Ir a Configuración
        </Link>
      </div>
    </div>
  );
}
