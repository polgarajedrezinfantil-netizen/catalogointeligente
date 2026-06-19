import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Identificador } from "./Identificador";

// Módulo de identificación de mercancía con IA + calculadora de ganancia.
export default async function IdentificarPage() {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) {
    return <p className="text-cacao">Esta sección es para administradores de una tienda.</p>;
  }
  const supabase = await createClient();
  const { data: tienda } = await supabase
    .from("tiendas")
    .select("ganancia_default, etiqueta_precio")
    .eq("id", perfil.tienda_id)
    .single();

  return (
    <div className="space-y-4">
      <h1 className="font-titulo text-2xl text-durazno">Identificar mercancía</h1>
      <p className="max-w-2xl text-sm text-cacao">
        Toma una foto del producto. La IA lo identifica (te pide datos extra si
        hace falta), tú confirmas la pieza exacta, buscamos su precio real nuevo
        y calculas tu ganancia antes de publicarlo.
      </p>
      <Identificador
        tiendaId={perfil.tienda_id}
        gananciaDefault={tienda?.ganancia_default ?? 0.5}
        simbolo={tienda?.etiqueta_precio ?? "$"}
      />
    </div>
  );
}
