import Image from "next/image";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { urlFoto } from "@/lib/fotos";
import type { Campo, Linea, Nido, Producto, EstadoProducto } from "@/lib/tipos";
import { FormProducto } from "./FormProducto";
import {
  crearProducto,
  actualizarProducto,
  borrarProducto,
  confirmarApartado,
  venderProducto,
  liberarApartado,
  agotarProducto,
} from "./actions";

// Link wa.me prearmado para dar seguimiento por WhatsApp.
function wa(celular: string | null, texto: string) {
  if (!celular) return "#";
  return `https://wa.me/${celular.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;
}

const ETIQUETA_ESTADO: Record<EstadoProducto, { txt: string; cls: string }> = {
  disponible: { txt: "Disponible", cls: "bg-verde-mielina/30 text-[#3f5a1c]" },
  apartada: { txt: "Apartada", cls: "bg-durazno/30 text-[#7a3a26]" },
  apartada_firme: { txt: "En firme", cls: "bg-sol/40 text-[#7a5414]" },
  vendida: { txt: "Vendida", cls: "bg-cacao/30 text-cacao" },
  agotada: { txt: "Agotada", cls: "bg-cacao/20 text-cacao" },
};

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
    supabase.from("productos").select("*").eq("tienda_id", t).order("creado", { ascending: false }),
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

  const nombreLinea = (id: string | null) =>
    lineas.find((l) => l.id === id)?.nombre ?? "—";
  const nombreNido = (id: string | null) =>
    nidos.find((n) => n.id === id)?.nombre ?? "—";

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="font-titulo text-2xl text-durazno">Productos</h1>

      {lineas.length === 0 && (
        <p className="rounded-xl bg-miel/30 p-3 text-sm text-[#7a5a14]">
          Primero crea al menos una <strong>línea de venta</strong> en
          Configuración.
        </p>
      )}

      {/* Alta */}
      <details open className="rounded-[var(--radius-marca)]">
        <summary className="cursor-pointer font-titulo text-lg text-coral">
          + Nuevo producto
        </summary>
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

      {/* Lista */}
      <div className="space-y-3">
        {productos.length === 0 && (
          <p className="text-cacao">Aún no hay productos.</p>
        )}
        {productos.map((p) => {
          const et = ETIQUETA_ESTADO[p.estado];
          return (
            <div
              key={p.id}
              className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4"
            >
              <div className="flex gap-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-crema">
                  {p.fotos[0] && (
                    <Image
                      src={urlFoto(p.fotos[0])}
                      alt={p.nombre}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-producto text-lg font-bold text-texto">
                      {p.nombre}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${et.cls}`}>
                      {et.txt}
                    </span>
                  </div>
                  <p className="text-sm text-cacao">
                    {simbolo}
                    {p.precio} · {nombreLinea(p.linea_id)} · Nido:{" "}
                    {nombreNido(p.nido_id)} · {p.cantidad} pza(s)
                  </p>
                  {p.holder_celular && (
                    <p className="text-xs text-durazno">
                      Apartada por:{" "}
                      <a
                        href={wa(p.holder_celular, `Hola, sobre tu apartado de "${p.nombre}".`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold underline"
                      >
                        {p.holder_celular}
                      </a>
                    </p>
                  )}

                  {/* Lista de espera con seguimiento por WhatsApp */}
                  {cola.filter((c) => c.producto_id === p.id).length > 0 && (
                    <p className="mt-1 text-xs text-cacao">
                      En cola:{" "}
                      {cola
                        .filter((c) => c.producto_id === p.id)
                        .map((c) => (
                          <a
                            key={c.celular}
                            href={wa(c.celular, `Hola, se liberó "${p.nombre}", ¿la quieres?`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mr-2 underline"
                          >
                            #{c.posicion} {c.celular}
                          </a>
                        ))}
                    </p>
                  )}

                  {/* Tablero de apartado (Fase 4) */}
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {p.estado === "apartada" && (
                      <FormBtn action={confirmarApartado} id={p.id} label="Confirmar (en firme)" cls="bg-sol/40 text-[#7a5414]" />
                    )}
                    {(p.estado === "apartada" || p.estado === "apartada_firme") && (
                      <FormBtn action={liberarApartado} id={p.id} label="Liberar → siguiente" />
                    )}
                    {p.estado !== "vendida" && p.estado !== "agotada" && (
                      <form action={venderProducto} className="flex items-center gap-1">
                        <input type="hidden" name="producto_id" value={p.id} />
                        <input
                          name="precio_final"
                          type="number"
                          step="0.01"
                          placeholder={`${p.precio}`}
                          className="w-20 rounded-lg border border-miel-borde bg-crema px-2 py-1 text-xs"
                        />
                        <button className="rounded-full bg-verde-mielina px-2.5 py-1 text-xs font-bold text-white">
                          Vender
                        </button>
                      </form>
                    )}
                    {p.estado !== "agotada" && (
                      <FormBtn action={agotarProducto} id={p.id} label="Agotada" />
                    )}
                  </div>
                </div>
              </div>

              {/* Editar */}
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-verde-mielina">
                  Editar
                </summary>
                <div className="mt-2">
                  <FormProducto
                    tiendaId={t}
                    lineas={lineas}
                    campos={campos}
                    nidos={nidos}
                    gananciaDefault={ganancia}
                    accion={actualizarProducto}
                    producto={p}
                  />
                  <form action={borrarProducto} className="mt-2">
                    <input type="hidden" name="producto_id" value={p.id} />
                    <button className="text-xs font-semibold text-durazno hover:underline">
                      Eliminar producto
                    </button>
                  </form>
                </div>
              </details>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Botón de una acción de apartado (form con producto_id oculto).
function FormBtn({
  action,
  id,
  label,
  cls,
}: {
  action: (fd: FormData) => Promise<void>;
  id: string;
  label: string;
  cls?: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="producto_id" value={id} />
      <button
        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
          cls ?? "border border-miel-borde text-cacao"
        }`}
      >
        {label}
      </button>
    </form>
  );
}
