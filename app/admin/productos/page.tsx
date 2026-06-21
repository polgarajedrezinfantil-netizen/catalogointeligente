import Link from "next/link";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Campo, Linea, Nido, Producto } from "@/lib/tipos";
import { FormProducto } from "./FormProducto";
import { RejillaProductos } from "./RejillaProductos";
import { ImportarPDF } from "./ImportarPDF";
import { crearProducto } from "./actions";

export default async function ProductosPage() {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) {
    return <p className="text-cacao">Esta sección es para administradores de una tienda.</p>;
  }
  const t = perfil.tienda_id;
  const supabase = await createClient();

  const [
    { data: lineasData },
    { data: camposData },
    { data: nidosData },
    { data: productosData },
    { data: tienda },
    { data: colaData },
  ] = await Promise.all([
    supabase.from("lineas_de_venta").select("*").eq("tienda_id", t).eq("archivada", false).order("orden"),
    supabase.from("campos_linea").select("*").eq("tienda_id", t).order("orden"),
    supabase.from("nidos").select("*").eq("tienda_id", t).order("orden"),
    supabase.from("productos").select("*").eq("tienda_id", t).order("orden", { ascending: true }).order("creado", { ascending: false }),
    supabase.from("tiendas").select("ganancia_default, etiqueta_precio").eq("id", t).single(),
    supabase.from("lista_espera").select("producto_id, celular, posicion").eq("tienda_id", t).order("posicion"),
  ]);

  const lineas = (lineasData ?? []) as Linea[];
  const campos = (camposData ?? []) as Campo[];
  const nidos = (nidosData ?? []) as Nido[];
  const productos = (productosData ?? []) as Producto[];
  const cola = (colaData ?? []) as { producto_id: string; celular: string; posicion: number }[];
  const ganancia = tienda?.ganancia_default ?? 0.5;
  const simbolo = tienda?.etiqueta_precio ?? "$";

  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="font-titulo text-2xl text-durazno">Productos</h1>

      {lineas.length === 0 && (
        <p className="rounded-xl bg-miel/30 p-3 text-sm text-[#7a5a14]">
          Primero crea al menos una <strong>línea de venta</strong> en Configuración.
        </p>
      )}

      {/* Carga masiva por PDF */}
      <ImportarPDF tiendaId={t} lineas={lineas} nidos={nidos} />

      {/* Alta individual */}
      <details className="rounded-[var(--radius-marca)]">
        <summary className="cursor-pointer font-titulo text-lg text-coral">+ Nuevo producto</summary>
        <div className="mt-3">
          <FormProducto
            tiendaId={t}
            lineas={lineas}
            campos={campos}
            nidos={nidos}
            gananciaDefault={ganancia}
            accion={crearProducto}
          />
        </div>
      </details>

      {/* Ver, ordenar y editar como cliente */}
      {productos.length > 0 && (
        <Link
          href="/admin/vista"
          className="flex items-center gap-3 rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4 transition hover:bg-miel/20"
        >
          <span className="text-2xl">👁️</span>
          <span className="flex-1">
            <span className="block font-titulo text-lg text-coral">Vista cliente</span>
            <span className="block text-sm text-cacao">
              Mira tu catálogo como tu cliente y <strong>reordena arrastrando</strong> o edita ahí mismo.
            </span>
          </span>
          <span className="text-cacao">→</span>
        </Link>
      )}

      {/* Cuadrícula: toca una prenda para editarla */}
      <RejillaProductos
        tiendaId={t}
        lineas={lineas}
        campos={campos}
        nidos={nidos}
        gananciaDefault={ganancia}
        simbolo={simbolo}
        productos={productos}
        cola={cola}
      />
    </div>
  );
}
