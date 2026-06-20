import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Tienda } from "@/lib/tipos";
import { TEMA_DEFAULT } from "@/lib/tema";
import { EditorApariencia } from "./EditorApariencia";

// Panel de Apariencia del admin de tienda: paleta, textos, banner y preview
// social, con vista previa en vivo.
export default async function AparienciaPage() {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) {
    return (
      <p className="text-cacao">
        Esta sección es para administradores de una tienda.
      </p>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("tiendas")
    .select("*")
    .eq("id", perfil.tienda_id)
    .single();
  const tienda = data as Tienda;

  const marca = tienda.nombre.split(" - ")[0];
  const handle = tienda.instagram_url
    ? "@" + tienda.instagram_url.replace(/\/+$/, "").split("/").pop()
    : null;

  return (
    <div className="space-y-4">
      <h1 className="font-titulo text-2xl text-durazno">Apariencia</h1>
      <p className="max-w-2xl text-sm text-cacao">
        Personaliza cómo se ve tu catálogo. Los cambios se reflejan al guardar,
        sin esperar a nadie.
      </p>
      <EditorApariencia
        tiendaId={tienda.id}
        nombre={tienda.nombre}
        marca={marca}
        handle={handle}
        logoUrl={tienda.logo_url}
        tema={{ ...TEMA_DEFAULT, ...(tienda.tema ?? {}) }}
        subtitulo={tienda.subtitulo ?? ""}
        descripcion={tienda.descripcion ?? ""}
        ogTitulo={tienda.og_titulo ?? ""}
        ogDescripcion={tienda.og_descripcion ?? ""}
        banner={tienda.banner_url ?? ""}
      />
    </div>
  );
}
