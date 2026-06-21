import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { GuiaTallas, Linea } from "@/lib/tipos";
import { EditorGuia } from "./EditorGuia";

export default async function TallasPage() {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) {
    return <p className="text-cacao">Esta sección es para administradores de una tienda.</p>;
  }
  const t = perfil.tienda_id;
  const supabase = await createClient();

  const [{ data: guiasData }, { data: lineasData }] = await Promise.all([
    supabase.from("guias_tallas").select("*").eq("tienda_id", t).order("orden").order("creado"),
    supabase.from("lineas_de_venta").select("*").eq("tienda_id", t).eq("archivada", false).order("orden"),
  ]);
  const guias = (guiasData ?? []) as GuiaTallas[];
  const lineas = (lineasData ?? []) as Linea[];
  const nombreLinea = (id: string | null) =>
    id ? lineas.find((l) => l.id === id)?.nombre ?? "Línea" : "General";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-titulo text-2xl text-durazno">Guía de tallas</h1>
        <p className="text-sm text-cacao">
          Crea tablas de referencia (talla, edad, medidas…). El cliente las verá con el botón
          <strong> 📏 Guía de tallas</strong> dentro de cada prenda. Puedes hacer una general o
          una por línea (Ropa, Calzado…).
        </p>
      </div>

      {guias.length > 0 && (
        <div className="space-y-4">
          {guias.map((g) => (
            <details key={g.id} className="rounded-[var(--radius-marca)] border border-miel-borde bg-crema/40 p-2">
              <summary className="cursor-pointer px-2 py-1 font-titulo text-coral">
                {g.nombre}{" "}
                <span className="text-xs font-normal text-cacao">· {nombreLinea(g.linea_id)} · {g.filas.length} filas</span>
              </summary>
              <div className="mt-2">
                <EditorGuia lineas={lineas} guia={g} />
              </div>
            </details>
          ))}
        </div>
      )}

      <section>
        <h2 className="mb-2 font-titulo text-lg text-coral">+ Nueva guía</h2>
        <EditorGuia lineas={lineas} />
      </section>
    </div>
  );
}
