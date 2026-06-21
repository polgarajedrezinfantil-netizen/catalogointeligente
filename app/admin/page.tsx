import Link from "next/link";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Estrella } from "@/components/marca/Elementos";
import type { EstadoProducto, Linea, Producto } from "@/lib/tipos";

const ESTADOS: { clave: EstadoProducto; txt: string; cls: string }[] = [
  { clave: "disponible", txt: "Disponible", cls: "bg-verde-mielina" },
  { clave: "apartada", txt: "Apartada", cls: "bg-durazno" },
  { clave: "apartada_firme", txt: "En firme", cls: "bg-sol" },
  { clave: "vendida", txt: "Vendida", cls: "bg-cacao" },
  { clave: "agotada", txt: "Agotada", cls: "bg-cacao/60" },
];

// Precio que ve el cliente (oferta si la hay, si no el precio normal).
function precioPub(p: Producto) {
  return p.precio_oferta != null ? Number(p.precio_oferta) : Number(p.precio);
}

function Tarjeta({ titulo, valor, sub }: { titulo: string; valor: string; sub?: string }) {
  return (
    <div className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
      <p className="text-xs text-cacao">{titulo}</p>
      <p className="font-titulo text-2xl text-durazno">{valor}</p>
      {sub && <p className="text-xs text-cacao">{sub}</p>}
    </div>
  );
}

// Inicio del panel. Distinto para superadmin y para admin de tienda.
export default async function AdminInicio() {
  const perfil = await getPerfil();
  if (!perfil) return null;

  // --- Superadmin: gestión del SaaS ---
  if (perfil.rol === "superadmin") {
    const supabase = await createClient();
    const { count } = await supabase
      .from("tiendas")
      .select("id", { count: "exact", head: true });
    return (
      <div className="space-y-4">
        <h1 className="font-titulo text-2xl text-durazno">Panel de Superadmin</h1>
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

  // --- Admin de tienda: inicio = resumen (dashboard fusionado) ---
  if (!perfil.tienda_id) return null;
  const t = perfil.tienda_id;
  const supabase = await createClient();

  const [
    { data: prodData },
    { data: lineasData },
    { data: apartarEv },
    { data: verEv },
    { data: solicitudes },
    { data: tienda },
    { count: numClientes },
  ] = await Promise.all([
    supabase.from("productos").select("*").eq("tienda_id", t),
    supabase.from("lineas_de_venta").select("*").eq("tienda_id", t),
    supabase.from("eventos_apartado").select("producto_id").eq("tienda_id", t).eq("tipo", "apartar"),
    supabase.from("eventos_cliente").select("ref_id").eq("tienda_id", t).eq("tipo", "abrir_producto"),
    supabase.from("solicitudes_cliente").select("texto, estado, creado").eq("tienda_id", t).order("creado", { ascending: false }),
    supabase.from("tiendas").select("etiqueta_precio").eq("id", t).single(),
    supabase.from("clientes").select("id", { count: "exact", head: true }).eq("tienda_id", t),
  ]);

  const productos = (prodData ?? []) as Producto[];
  const lineas = (lineasData ?? []) as Linea[];
  const simbolo = tienda?.etiqueta_precio ?? "$";

  const vendidos = productos.filter((p) => p.estado === "vendida");
  const noVendidos = productos.filter((p) => p.estado !== "vendida");
  // "Existentes": lo que aún puedes vender (no vendido y con stock).
  const existentes = productos.filter(
    (p) => p.estado !== "vendida" && p.estado !== "agotada",
  );

  // Ya realizado (de lo vendido):
  const ingresos = vendidos.reduce((a, p) => a + Number(p.precio), 0);
  const gananciaReal = vendidos.reduce((a, p) => a + (Number(p.precio) - Number(p.costo)), 0);

  // Proyección de TODO el inventario existente al precio publicado:
  const invertido = existentes.reduce((a, p) => a + Number(p.costo) * Number(p.cantidad), 0);
  const ventaPotencial = existentes.reduce((a, p) => a + precioPub(p) * Number(p.cantidad), 0);
  const gananciaEstimada = ventaPotencial - invertido; // = venta potencial − invertido

  // Conteos por estado y por línea
  const porEstado = ESTADOS.map((e) => ({
    ...e,
    n: productos.filter((p) => p.estado === e.clave).length,
  }));
  const porLinea = lineas
    .map((l) => ({ nombre: `${l.icono} ${l.nombre}`, n: productos.filter((p) => p.linea_id === l.id).length }))
    .filter((x) => x.n > 0);

  // Top apartados / vistos
  const cuenta = (rows: { k: string | null }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.k) m.set(r.k, (m.get(r.k) ?? 0) + 1);
    return m;
  };
  const apMap = cuenta((apartarEv ?? []).map((e) => ({ k: e.producto_id })));
  const verMap = cuenta((verEv ?? []).map((e) => ({ k: e.ref_id })));
  const nombreProd = (id: string) => productos.find((p) => p.id === id)?.nombre ?? "—";
  const top = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const maxLinea = Math.max(1, ...porLinea.map((x) => x.n));

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="font-titulo text-2xl text-durazno">
        Hola, {perfil.nombre} 🍯
      </h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tarjeta titulo="Productos" valor={String(productos.length)} sub={`${existentes.length} por vender`} />
        <Tarjeta titulo="Vendidos" valor={String(vendidos.length)} sub={`No vendidos: ${noVendidos.length}`} />
        <Tarjeta titulo="Ya ingresado" valor={`${simbolo}${ingresos.toFixed(0)}`} sub={`Ganancia real: ${simbolo}${gananciaReal.toFixed(0)}`} />
        <Tarjeta titulo="Ganancia estimada" valor={`${simbolo}${gananciaEstimada.toFixed(0)}`} sub="Si vendes todo lo existente" />
      </div>

      {/* Explicación de las cifras de dinero */}
      <section className="rounded-[var(--radius-marca)] border border-miel-borde bg-miel/20 p-4 text-sm text-[#7a5a14]">
        <p className="mb-1 font-semibold">Proyección de tu inventario actual</p>
        <ul className="space-y-1">
          <li>
            💰 <strong>Invertido:</strong> {simbolo}{invertido.toFixed(0)} — lo que te costó la mercancía que aún no vendes (costo × piezas).
          </li>
          <li>
            🏷️ <strong>Venta potencial:</strong> {simbolo}{ventaPotencial.toFixed(0)} — si vendes todo lo existente al precio publicado.
          </li>
          <li>
            🍯 <strong>Ganancia estimada:</strong> {simbolo}{gananciaEstimada.toFixed(0)} — venta potencial menos lo invertido.
          </li>
        </ul>
      </section>

      {/* Por estado */}
      <section className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
        <h2 className="mb-3 font-titulo text-coral">Por estado</h2>
        <div className="flex flex-wrap gap-2">
          {porEstado.map((e) => (
            <span key={e.clave} className={`rounded-full px-3 py-1 text-sm font-bold text-white ${e.cls}`}>
              {e.txt}: {e.n}
            </span>
          ))}
        </div>
      </section>

      {/* Por línea */}
      <section className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
        <h2 className="mb-3 font-titulo text-coral">Productos por línea</h2>
        {porLinea.length === 0 ? (
          <p className="text-cacao">Sin datos.</p>
        ) : (
          <div className="space-y-2">
            {porLinea.map((x) => (
              <div key={x.nombre} className="flex items-center gap-2 text-sm">
                <span className="w-28 shrink-0 text-texto">{x.nombre}</span>
                <span className="h-4 rounded-full bg-verde-mielina" style={{ width: `${(x.n / maxLinea) * 100}%` }} />
                <span className="text-cacao">{x.n}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Top apartados / vistos */}
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
          <h2 className="mb-2 font-titulo text-coral">Más apartados</h2>
          {top(apMap).length === 0 ? <p className="text-cacao text-sm">Sin apartados aún.</p> : (
            <ol className="space-y-1 text-sm">
              {top(apMap).map(([id, n]) => (
                <li key={id} className="flex justify-between"><span>{nombreProd(id)}</span><strong>{n}</strong></li>
              ))}
            </ol>
          )}
        </section>
        <section className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
          <h2 className="mb-2 font-titulo text-coral">Más vistos</h2>
          {top(verMap).length === 0 ? <p className="text-cacao text-sm">Sin vistas aún.</p> : (
            <ol className="space-y-1 text-sm">
              {top(verMap).map(([id, n]) => (
                <li key={id} className="flex justify-between"><span>{nombreProd(id)}</span><strong>{n}</strong></li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* Solicitudes / lo más buscado */}
      <section className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
        <h2 className="mb-2 font-titulo text-coral">
          Lo que buscan los clientes ({(solicitudes ?? []).filter((s) => s.estado === "abierta").length} abiertas)
        </h2>
        <p className="mb-2 text-xs text-cacao">Clientes registrados: {numClientes ?? 0}</p>
        {(solicitudes ?? []).length === 0 ? (
          <p className="text-cacao text-sm">Aún no hay solicitudes.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {(solicitudes ?? []).slice(0, 10).map((s, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${s.estado === "abierta" ? "bg-durazno" : "bg-cacao/40"}`} />
                <span className="text-texto">{s.texto}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
