import Image from "next/image";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { urlFoto } from "@/lib/fotos";
import type { Nido } from "@/lib/tipos";
import { SubirFotos } from "@/components/SubirFotos";
import { NuevoNido } from "./NuevoNido";
import { BotonActivo } from "./BotonActivo";
import { actualizarNido, borrarNido } from "./actions";

export default async function NidosPage() {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) {
    return <p className="text-cacao">Esta sección es para administradores de una tienda.</p>;
  }

  const supabase = await createClient();
  const [{ data: nidosData }, { data: tienda }] = await Promise.all([
    supabase
      .from("nidos")
      .select("*")
      .eq("tienda_id", perfil.tienda_id)
      .order("orden"),
    supabase
      .from("tiendas")
      .select("plan_clave, planes(max_catalogos)")
      .eq("id", perfil.tienda_id)
      .single(),
  ]);

  const nidos = (nidosData ?? []) as Nido[];
  const activos = nidos.filter((n) => n.activo).length;
  // @ts-expect-error relación anidada
  const limite: number | null = tienda?.planes?.max_catalogos ?? null;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-titulo text-2xl text-durazno">Nidos</h1>
        <span className="rounded-full bg-miel px-3 py-1 text-sm text-[#7a5a14]">
          Activos: {activos}
          {limite == null ? " / ∞" : ` / ${limite}`}
        </span>
      </div>

      <NuevoNido tiendaId={perfil.tienda_id} />

      <div className="space-y-4">
        {nidos.length === 0 && (
          <p className="text-cacao">Aún no tienes Nidos. Crea el primero arriba.</p>
        )}
        {nidos.map((n) => (
          <div
            key={n.id}
            className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4"
          >
            <div className="flex gap-4">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-crema">
                {n.foto_portada_url && (
                  <Image
                    src={urlFoto(n.foto_portada_url)}
                    alt={n.nombre}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                )}
              </div>

              <form action={actualizarNido} className="flex-1 space-y-2">
                <input type="hidden" name="nido_id" value={n.id} />
                <div className="flex flex-wrap gap-2">
                  <input
                    name="nombre"
                    defaultValue={n.nombre}
                    className="flex-1 rounded-xl border border-miel-borde bg-crema px-3 py-2 font-producto font-bold"
                  />
                  <input
                    name="fecha"
                    type="date"
                    defaultValue={n.fecha}
                    className="rounded-xl border border-miel-borde bg-crema px-3 py-2"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-cacao">
                  <input type="checkbox" name="es_nuevo" defaultChecked={n.es_nuevo} />
                  Marcar como “Nuevo”
                </label>
                <div>
                  <span className="text-xs text-cacao">Cambiar portada</span>
                  <SubirFotos
                    name="foto_portada_url"
                    tiendaId={perfil.tienda_id!}
                  />
                </div>
                <button className="rounded-full border border-miel-borde px-4 py-1.5 text-sm font-semibold">
                  Guardar
                </button>
              </form>

              <div className="flex flex-col items-end gap-2">
                <BotonActivo nidoId={n.id} activo={n.activo} />
                <form action={borrarNido}>
                  <input type="hidden" name="nido_id" value={n.id} />
                  <button className="text-xs font-semibold text-durazno hover:underline">
                    Eliminar
                  </button>
                </form>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
