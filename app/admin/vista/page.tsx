import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Campo, Producto, Tienda } from "@/lib/tipos";
import { VistaCliente } from "./VistaCliente";

// Vista Cliente: el admin ve su catálogo como lo ve el cliente y puede
// reordenar y editar las prendas ahí mismo.
export default async function VistaPage() {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) {
    return (
      <p className="text-cacao">Esta sección es para administradores de una tienda.</p>
    );
  }
  const t = perfil.tienda_id;
  const supabase = await createClient();
  const [{ data: tiendaData }, { data: productosData }, { data: camposData }] = await Promise.all([
    supabase.from("tiendas").select("*").eq("id", t).single(),
    supabase
      .from("productos")
      .select("*")
      .eq("tienda_id", t)
      .order("orden", { ascending: true })
      .order("creado", { ascending: false }),
    supabase.from("campos_linea").select("*").eq("tienda_id", t).order("orden"),
  ]);

  const tienda = tiendaData as Tienda;
  const productos = (productosData ?? []) as Producto[];
  const campos = (camposData ?? []) as Campo[];
  const marca = tienda.nombre.split(" - ")[0];
  const handle = tienda.instagram_url
    ? "@" + tienda.instagram_url.replace(/\/+$/, "").split("/").pop()
    : null;

  return (
    <VistaCliente
      marca={marca}
      handle={handle}
      subtitulo={tienda.subtitulo ?? ""}
      logoUrl={tienda.logo_url}
      bannerUrl={tienda.banner_url}
      simbolo={tienda.etiqueta_precio ?? "$"}
      tema={tienda.tema}
      productos={productos}
      campos={campos}
    />
  );
}
