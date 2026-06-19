import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Linea, Producto } from "@/lib/tipos";
import { EnviarMensaje } from "./EnviarMensaje";
import { atenderSolicitud } from "./actions";

type Cliente = {
  celular: string;
  nombre: string | null;
  correo: string | null;
  ultima_visita: string;
};

export default async function ClientesPage() {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) {
    return <p className="text-cacao">Esta sección es para administradores de una tienda.</p>;
  }
  const t = perfil.tienda_id;
  const supabase = await createClient();

  const [
    { data: clientesData },
    { data: prodData },
    { data: lineasData },
    { data: apEv },
    { data: verEv },
    { data: solData },
  ] = await Promise.all([
    supabase.from("clientes").select("celular, nombre, correo, ultima_visita").eq("tienda_id", t).order("ultima_visita", { ascending: false }),
    supabase.from("productos").select("id, linea_id").eq("tienda_id", t),
    supabase.from("lineas_de_venta").select("*").eq("tienda_id", t),
    supabase.from("eventos_apartado").select("celular, producto_id").eq("tienda_id", t).eq("tipo", "apartar"),
    supabase.from("eventos_cliente").select("celular, ref_id").eq("tienda_id", t).eq("tipo", "abrir_producto"),
    supabase.from("solicitudes_cliente").select("id, celular, texto, estado, creado").eq("tienda_id", t).order("creado", { ascending: false }),
  ]);

  const clientes = (clientesData ?? []) as Cliente[];
  const productos = (prodData ?? []) as Pick<Producto, "id" | "linea_id">[];
  const lineas = (lineasData ?? []) as Linea[];
  const solicitudes = (solData ?? []) as { id: string; celular: string | null; texto: string; estado: string; creado: string }[];

  const lineaDeProducto = (id: string | null) => productos.find((p) => p.id === id)?.linea_id ?? null;
  const nombreLinea = (id: string | null) => lineas.find((l) => l.id === id)?.nombre ?? null;

  // Interés por cliente: cuenta líneas de productos que apartó o vio.
  function interesDe(celular: string): string[] {
    const cuenta = new Map<string, number>();
    const sumar = (lineaId: string | null) => {
      const nom = nombreLinea(lineaId);
      if (nom) cuenta.set(nom, (cuenta.get(nom) ?? 0) + 1);
    };
    (apEv ?? []).filter((e) => e.celular === celular).forEach((e) => sumar(lineaDeProducto(e.producto_id)));
    (verEv ?? []).filter((e) => e.celular === celular).forEach((e) => sumar(lineaDeProducto(e.ref_id)));
    return [...cuenta.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n);
  }

  const solDe = (celular: string) => solicitudes.filter((s) => s.celular === celular);

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-titulo text-2xl text-durazno">Clientes</h1>

      {/* Bandeja de solicitudes abiertas */}
      <section className="rounded-[var(--radius-marca)] border border-dashed border-durazno bg-white p-4">
        <h2 className="mb-2 font-titulo text-coral">Solicitudes abiertas</h2>
        {solicitudes.filter((s) => s.estado === "abierta").length === 0 ? (
          <p className="text-sm text-cacao">No hay solicitudes pendientes.</p>
        ) : (
          <ul className="space-y-2">
            {solicitudes.filter((s) => s.estado === "abierta").map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-texto">
                  “{s.texto}” {s.celular && <span className="text-cacao">· {s.celular}</span>}
                </span>
                <form action={atenderSolicitud}>
                  <input type="hidden" name="solicitud_id" value={s.id} />
                  <button className="rounded-full border border-miel-borde px-2 py-1 text-xs font-semibold">
                    Atendida
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Base de datos de clientes */}
      <div className="space-y-3">
        {clientes.length === 0 && <p className="text-cacao">Aún no hay clientes registrados.</p>}
        {clientes.map((c) => {
          const interes = interesDe(c.celular);
          const sus = solDe(c.celular);
          return (
            <div key={c.celular} className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-producto text-lg font-bold text-texto">{c.nombre ?? "Cliente"}</span>
                <span className="text-sm text-cacao">{c.celular}</span>
                {c.correo && <span className="text-sm text-cacao">· {c.correo}</span>}
                <span className="ml-auto text-xs text-cacao">
                  últ. visita {new Date(c.ultima_visita).toLocaleDateString("es-MX")}
                </span>
              </div>

              {interes.length > 0 && (
                <p className="mt-1 text-xs text-cacao">
                  Interés:{" "}
                  {interes.map((i) => (
                    <span key={i} className="mr-1 rounded-full bg-miel px-2 py-0.5 text-[#7a5a14]">{i}</span>
                  ))}
                </p>
              )}

              {sus.length > 0 && (
                <p className="mt-1 text-xs text-cacao">
                  Ha buscado: {sus.map((s) => `“${s.texto}”`).join(", ")}
                </p>
              )}

              <EnviarMensaje celular={c.celular} correo={c.correo} nombre={c.nombre ?? ""} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
