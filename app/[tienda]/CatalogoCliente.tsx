"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { urlFoto } from "@/lib/fotos";
import type { Campo, EstadoProducto, Linea, Nido, Producto } from "@/lib/tipos";
import { datosClienteLocal } from "./CapturaCliente";

const ETIQUETA: Record<EstadoProducto, { txt: string; cls: string }> = {
  disponible: { txt: "Disponible", cls: "bg-verde-mielina text-white" },
  apartada: { txt: "Apartada", cls: "bg-durazno text-white" },
  apartada_firme: { txt: "En firme", cls: "bg-sol text-[#7a5414]" },
  vendida: { txt: "Vendida", cls: "bg-cacao text-white" },
  agotada: { txt: "Agotada", cls: "bg-cacao/70 text-white" },
};

type TiendaMin = {
  id: string;
  simbolo: string;
  whatsapp: string | null;
  datosPago: string | null;
};

// Texto de existencias para mostrar al cliente.
function textoStock(p: Producto): string | null {
  if (p.estado === "vendida" || p.estado === "agotada") return null;
  const n = p.cantidad ?? 0;
  if (n <= 0) return null;
  if (n === 1) return "🔥 ¡Último disponible!";
  return `📦 ${n} disponibles`;
}

export function CatalogoCliente({
  tienda,
  nidos,
  lineas,
  campos,
  productos: productosIniciales,
}: {
  tienda: TiendaMin;
  nidos: Nido[];
  lineas: Linea[];
  campos: Campo[];
  productos: Producto[];
}) {
  const supabase = createClient();
  const [productos, setProductos] = useState<Producto[]>(productosIniciales);
  const [lineaSel, setLineaSel] = useState<string>("");
  const [nidoSel, setNidoSel] = useState<string>("");
  const [filtros, setFiltros] = useState<Record<string, string>>({});
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [vistos, setVistos] = useState<Set<string>>(new Set());
  const [miCelular, setMiCelular] = useState<string>("");
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set());
  const [soloFavoritos, setSoloFavoritos] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<"recomendado" | "precio_asc" | "precio_desc">("recomendado");
  const [soloDisponibles, setSoloDisponibles] = useState(false);
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);
  const [filtrosAbierto, setFiltrosAbierto] = useState(false);
  const [generoSel, setGeneroSel] = useState<"" | "nino" | "nina" | "unisex">("");
  const [turno, setTurno] = useState<{ id: string; nombre: string } | null>(null);
  const miCelularRef = useRef("");

  // Quién es el cliente en este dispositivo (para el carrito).
  useEffect(() => {
    const leer = () => {
      const cel = datosClienteLocal(tienda.id)?.celular ?? "";
      setMiCelular(cel);
      miCelularRef.current = cel;
    };
    leer();
    window.addEventListener("cliente-actualizado", leer);
    return () => window.removeEventListener("cliente-actualizado", leer);
  }, [tienda.id]);

  // Captura por intención: abre el modal de datos y reintenta la acción pendiente.
  const pendiente = useRef<null | (() => void)>(null);
  function pedirDatos(cb: () => void) {
    pendiente.current = cb;
    window.dispatchEvent(new CustomEvent("pedir-datos"));
  }
  useEffect(() => {
    const onListo = () => {
      setMiCelular(datosClienteLocal(tienda.id)?.celular ?? "");
      const cb = pendiente.current;
      pendiente.current = null;
      cb?.();
    };
    window.addEventListener("datos-listos", onListo);
    return () => window.removeEventListener("datos-listos", onListo);
  }, [tienda.id]);

  // Favoritos (❤️ guardar para después, SIN bloquear inventario). Solo en el
  // dispositivo: no requiere dar datos.
  const claveFav = `fav_${tienda.id}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(claveFav);
      if (raw) setFavoritos(new Set(JSON.parse(raw)));
    } catch {}
  }, [claveFav]);

  function alternarFavorito(id: string) {
    setFavoritos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(claveFav, JSON.stringify([...next]));
      return next;
    });
  }

  // Carrito = lo que el cliente apartó (sus productos en firme o reservados).
  const carrito = useMemo(
    () =>
      productos.filter(
        (p) =>
          !!miCelular &&
          p.holder_celular === miCelular &&
          (p.estado === "apartada" || p.estado === "apartada_firme"),
      ),
    [productos, miCelular],
  );

  // Avisa el conteo a la barra inferior y atiende abrir/pedir conteo.
  useEffect(() => {
    const emitir = () =>
      window.dispatchEvent(new CustomEvent("carrito-conteo", { detail: carrito.length }));
    const abrir = () => setCarritoAbierto(true);
    window.addEventListener("pedir-conteo", emitir);
    window.addEventListener("abrir-carrito", abrir);
    emitir();
    return () => {
      window.removeEventListener("pedir-conteo", emitir);
      window.removeEventListener("abrir-carrito", abrir);
    };
  }, [carrito.length]);

  // Quitar del carrito = liberar el apartado (vuelve a quedar disponible).
  async function quitarDelCarrito(p: Producto) {
    setProductos((prev) =>
      prev.map((x) =>
        x.id === p.id
          ? { ...x, estado: "disponible", holder_celular: null, hold_expira: null }
          : x,
      ),
    );
    if (miCelular) {
      await supabase.rpc("liberar_producto", { p_producto: p.id, p_celular: miCelular });
    }
  }

  // Nidos vistos por este dispositivo (estilo "historias" de Instagram).
  const claveVistos = `vistos_${tienda.id}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(claveVistos);
      if (raw) setVistos(new Set(JSON.parse(raw)));
    } catch {}
  }, [claveVistos]);

  // Abre un Nido (historia): filtra, lo marca como visto (local + base).
  function abrirNido(id: string) {
    setNidoSel((sel) => (sel === id ? "" : id));
    const cel = datosClienteLocal(tienda.id)?.celular ?? "";
    supabase.rpc("registrar_evento_cliente", {
      p_tienda: tienda.id,
      p_celular: cel,
      p_tipo: "ver_nido",
      p_ref: id,
    });
    if (!vistos.has(id)) {
      const nuevos = new Set(vistos).add(id);
      setVistos(nuevos);
      localStorage.setItem(claveVistos, JSON.stringify([...nuevos]));
      if (cel) {
        supabase.rpc("marcar_nido_visto", {
          p_tienda: tienda.id,
          p_celular: cel,
          p_nido: id,
        });
      }
    }
  }

  // Abre la ficha de un producto y registra la vista (para perfilar al cliente).
  function verProducto(id: string) {
    setDetalleId(id);
    supabase.rpc("registrar_evento_cliente", {
      p_tienda: tienda.id,
      p_celular: datosClienteLocal(tienda.id)?.celular ?? "",
      p_tipo: "abrir_producto",
      p_ref: id,
    });
  }

  // Orden estilo historias: los NO vistos primero (con anillo y "Nuevo"),
  // los vistos se recorren a la derecha (en gris).
  const nidosOrdenados = useMemo(() => {
    const noVistos = nidos.filter((n) => !vistos.has(n.id));
    const yaVistos = nidos.filter((n) => vistos.has(n.id));
    return [...noVistos, ...yaVistos];
  }, [nidos, vistos]);

  // --- Tiempo real: cualquier cambio de un producto se refleja al instante.
  useEffect(() => {
    const canal = supabase
      .channel(`productos-${tienda.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "productos",
          filter: `tienda_id=eq.${tienda.id}`,
        },
        (payload) => {
          const nuevo = payload.new as Producto;
          setProductos((prev) => {
            // Aviso automático "es tu turno": si un producto que tenía OTRO
            // dueño pasó a ser mío, es que me promovieron de la fila.
            const anterior = prev.find((p) => p.id === nuevo.id);
            const cel = miCelularRef.current;
            if (
              cel &&
              nuevo.holder_celular === cel &&
              anterior &&
              anterior.holder_celular !== cel
            ) {
              setTimeout(() => setTurno({ id: nuevo.id, nombre: nuevo.nombre }), 0);
            }
            return prev.map((p) => (p.id === nuevo.id ? { ...p, ...nuevo } : p));
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [supabase, tienda.id]);

  // La barra inferior pide abrir el buscador desplegable.
  useEffect(() => {
    const abrir = () => setBuscadorAbierto(true);
    window.addEventListener("abrir-buscador", abrir);
    return () => window.removeEventListener("abrir-buscador", abrir);
  }, []);

  const camposFiltro = useMemo(
    () => (lineaSel ? campos.filter((c) => c.linea_id === lineaSel) : []),
    [campos, lineaSel],
  );

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const arr = productos.filter((p) => {
      if (soloFavoritos && !favoritos.has(p.id)) return false;
      if (soloDisponibles && p.estado !== "disponible") return false;
      if (generoSel && p.genero !== generoSel) return false;
      if (lineaSel && p.linea_id !== lineaSel) return false;
      if (nidoSel && p.nido_id !== nidoSel) return false;
      if (q) {
        const enNombre = p.nombre.toLowerCase().includes(q);
        const enDesc = (p.descripcion ?? "").toLowerCase().includes(q);
        const enAttr = Object.values(p.atributos ?? {}).some((v) =>
          String(Array.isArray(v) ? v.join(" ") : (v ?? ""))
            .toLowerCase()
            .includes(q),
        );
        if (!enNombre && !enDesc && !enAttr) return false;
      }
      for (const [campoId, val] of Object.entries(filtros)) {
        if (!val) continue;
        const attr = p.atributos?.[campoId];
        if (Array.isArray(attr)) {
          if (!attr.map(String).includes(val)) return false;
        } else if (String(attr ?? "").toLowerCase() !== val.toLowerCase()) {
          return false;
        }
      }
      return true;
    });
    if (orden === "precio_asc") return [...arr].sort((a, b) => a.precio - b.precio);
    if (orden === "precio_desc") return [...arr].sort((a, b) => b.precio - a.precio);
    return arr; // "recomendado" = orden del servidor (más nuevos primero)
  }, [productos, lineaSel, nidoSel, filtros, busqueda, orden, soloFavoritos, favoritos, soloDisponibles, generoSel]);

  const detalle = productos.find((p) => p.id === detalleId) ?? null;

  // Cuántos filtros "avanzados" hay activos (para el badge del botón Filtros).
  const filtrosActivos =
    (soloDisponibles ? 1 : 0) +
    (orden !== "recomendado" ? 1 : 0) +
    Object.values(filtros).filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Aviso automático: te promovieron en la fila */}
      {turno && (
        <div className="flex items-center gap-2 rounded-xl bg-verde-mielina/15 px-3 py-2 text-sm text-[#3f5a1c]">
          <span className="text-lg">🍯</span>
          <span className="flex-1">
            ¡Es tu turno! <strong>{turno.nombre}</strong> se liberó y quedó apartado para ti.
          </span>
          <button
            onClick={() => {
              const id = turno.id;
              setTurno(null);
              verProducto(id);
            }}
            className="rounded-full bg-verde-mielina px-3 py-1 text-xs font-bold text-white"
          >
            Verlo
          </button>
          <button onClick={() => setTurno(null)} aria-label="Cerrar" className="text-cacao">✕</button>
        </div>
      )}

      {/* Historias estilo Instagram */}
      {nidos.length > 0 && (
        <div className="flex gap-3 overflow-x-auto border-b border-miel-borde px-1 pb-3">
          {nidosOrdenados.map((n) => (
            <NidoBurbuja
              key={n.id}
              activo={nidoSel === n.id}
              onClick={() => abrirNido(n.id)}
              label={n.nombre}
              foto={n.foto_portada_url}
              visto={vistos.has(n.id)}
            />
          ))}
        </div>
      )}

      {/* Fila única de filtros rápidos + búsqueda (icono) + Filtros */}
      <div id="buscador" className="flex items-center gap-2">
        <div className="flex flex-1 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Chip
            activo={lineaSel === "" && generoSel === "" && !soloFavoritos}
            onClick={() => { setLineaSel(""); setGeneroSel(""); setSoloFavoritos(false); setFiltros({}); }}
          >
            Todo
          </Chip>
          <Chip activo={generoSel === "nino"} onClick={() => setGeneroSel(generoSel === "nino" ? "" : "nino")}>👦 Niño</Chip>
          <Chip activo={generoSel === "nina"} onClick={() => setGeneroSel(generoSel === "nina" ? "" : "nina")}>👧 Niña</Chip>
          {favoritos.size > 0 && (
            <Chip activo={soloFavoritos} onClick={() => setSoloFavoritos((v) => !v)}>❤️ {favoritos.size}</Chip>
          )}
          {lineas.map((l) => (
            <Chip
              key={l.id}
              activo={lineaSel === l.id}
              onClick={() => { setLineaSel(lineaSel === l.id ? "" : l.id); setFiltros({}); }}
              color={l.color}
            >
              {l.icono} {l.nombre}
            </Chip>
          ))}
        </div>
        <button
          onClick={() => { setBuscadorAbierto((v) => !v); }}
          aria-label="Buscar"
          className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${buscadorAbierto || busqueda ? "border-verde-mielina bg-verde-mielina text-white" : "border-miel-borde bg-white text-texto"}`}
        >
          🔍
        </button>
        <button
          onClick={() => setFiltrosAbierto(true)}
          className={`relative shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${filtrosActivos > 0 ? "border-verde-mielina bg-verde-mielina text-white" : "border-miel-borde bg-white text-texto"}`}
        >
          Filtros
          {filtrosActivos > 0 && (
            <span className="ml-1 rounded-full bg-white/30 px-1 text-xs">{filtrosActivos}</span>
          )}
        </button>
      </div>

      {/* Buscador desplegable */}
      {buscadorAbierto && (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cacao">🔍</span>
          <input
            autoFocus
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar en el catálogo…"
            className="w-full rounded-full border border-miel-borde bg-white py-2 pl-9 pr-9 text-sm outline-none focus:border-verde-mielina"
          />
          <button
            onClick={() => { setBusqueda(""); setBuscadorAbierto(false); }}
            aria-label="Cerrar búsqueda"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-cacao"
          >
            ✕
          </button>
        </div>
      )}

      {nidoSel && (
        <div className="flex items-center justify-between rounded-xl bg-miel/40 px-3 py-2 text-sm text-[#7a5a14]">
          <span>
            Viendo Nido:{" "}
            <strong>{nidos.find((n) => n.id === nidoSel)?.nombre}</strong>
          </span>
          <button onClick={() => setNidoSel("")} className="font-semibold underline">
            Ver todos ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        {visibles.map((p) => (
          <div key={p.id} className="relative overflow-hidden rounded-2xl border border-miel-borde bg-white">
            <button onClick={() => verProducto(p.id)} className="block w-full text-left">
              <div className="relative aspect-[4/5] bg-crema">
                {p.fotos[0] && (
                  <Image src={urlFoto(p.fotos[0])} alt={p.nombre} fill sizes="50vw" className="object-cover" />
                )}
                {/* Badges arriba-izquierda */}
                <div className="pointer-events-none absolute left-1.5 top-1.5 flex flex-col items-start gap-1">
                  {p.estado !== "disponible" ? (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ETIQUETA[p.estado].cls}`}>
                      {ETIQUETA[p.estado].txt}
                    </span>
                  ) : (
                    esNuevo(p) && (
                      <span className="rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold text-white">🆕 Nuevo</span>
                    )
                  )}
                  {p.estado === "disponible" && p.cantidad === 1 && (
                    <span className="rounded-full bg-durazno px-2 py-0.5 text-[10px] font-bold text-white">🔥 Último</span>
                  )}
                </div>
              </div>
              <div className="px-2.5 py-2">
                <p className="truncate text-xs font-semibold text-texto">{p.nombre}</p>
                <p className="font-producto text-base font-bold text-[#7a5414]">{tienda.simbolo}{p.precio}</p>
              </div>
            </button>
            <button
              onClick={() => alternarFavorito(p.id)}
              aria-label={favoritos.has(p.id) ? "Quitar de favoritos" : "Guardar en favoritos"}
              className="absolute right-1.5 top-1.5 text-lg drop-shadow"
            >
              {favoritos.has(p.id) ? "❤️" : "🤍"}
            </button>
          </div>
        ))}
      </div>
      {visibles.length === 0 && (
        <p className="py-8 text-center text-cacao">
          {soloFavoritos
            ? "Aún no tienes favoritos. Toca el 🤍 en un producto."
            : "No hay productos con esos filtros."}
        </p>
      )}

      <BuscaProducto tiendaId={tienda.id} />

      {detalle && (
        <DetalleProducto
          producto={detalle}
          campos={campos}
          lineas={lineas}
          tienda={tienda}
          celular={miCelular}
          esFavorito={favoritos.has(detalle.id)}
          onFavorito={() => alternarFavorito(detalle.id)}
          onPedirDatos={pedirDatos}
          onCerrar={() => setDetalleId(null)}
        />
      )}

      {carritoAbierto && (
        <Carrito
          items={carrito}
          tienda={tienda}
          onQuitar={quitarDelCarrito}
          onCerrar={() => setCarritoAbierto(false)}
          onAbrirProducto={(id) => {
            setCarritoAbierto(false);
            verProducto(id);
          }}
        />
      )}

      {filtrosAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-cacao/50 sm:items-center sm:p-4"
          onClick={() => setFiltrosAbierto(false)}
        >
          <div
            className="w-full max-w-md rounded-t-[var(--radius-marca)] bg-white p-4 sm:rounded-[var(--radius-marca)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-titulo text-lg text-durazno">Filtros y orden</h3>
              <button onClick={() => setFiltrosAbierto(false)} aria-label="Cerrar" className="text-cacao">✕</button>
            </div>

            <p className="mb-1 text-sm font-semibold text-cacao">Ordenar por</p>
            <div className="mb-4 flex flex-wrap gap-2">
              <Chip activo={orden === "recomendado"} onClick={() => setOrden("recomendado")}>🆕 Novedades</Chip>
              <Chip activo={orden === "precio_asc"} onClick={() => setOrden("precio_asc")}>Precio ↑</Chip>
              <Chip activo={orden === "precio_desc"} onClick={() => setOrden("precio_desc")}>Precio ↓</Chip>
            </div>

            <label className="mb-4 flex items-center gap-2 text-sm font-semibold text-texto">
              <input
                type="checkbox"
                checked={soloDisponibles}
                onChange={(e) => setSoloDisponibles(e.target.checked)}
                className="accent-verde-mielina"
              />
              Mostrar solo disponibles
            </label>

            {camposFiltro.length > 0 && (
              <div className="mb-4 space-y-2">
                {camposFiltro.map((c) => (
                  <label key={c.id} className="block text-sm text-cacao">
                    <span className="mb-1 block font-semibold">{c.nombre}</span>
                    {c.tipo === "lista" || c.tipo === "multi" ? (
                      <select
                        value={filtros[c.id] ?? ""}
                        onChange={(e) => setFiltros((f) => ({ ...f, [c.id]: e.target.value }))}
                        className="w-full rounded-lg border border-miel-borde bg-crema px-2 py-1.5"
                      >
                        <option value="">Todos</option>
                        {c.opciones.map((o) => (<option key={o} value={o}>{o}</option>))}
                      </select>
                    ) : (
                      <input
                        value={filtros[c.id] ?? ""}
                        onChange={(e) => setFiltros((f) => ({ ...f, [c.id]: e.target.value }))}
                        placeholder="…"
                        className="w-full rounded-lg border border-miel-borde bg-crema px-2 py-1.5"
                      />
                    )}
                  </label>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setOrden("recomendado"); setSoloDisponibles(false); setFiltros({}); }}
                className="flex-1 rounded-full border border-miel-borde bg-white py-2 text-sm font-bold text-texto"
              >
                Limpiar
              </button>
              <button
                onClick={() => setFiltrosAbierto(false)}
                className="flex-1 rounded-full bg-verde-mielina py-2 text-sm font-bold text-white"
              >
                Ver {visibles.length} productos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Producto creado hace menos de 14 días → badge "Nuevo".
function esNuevo(p: Producto): boolean {
  return Date.now() - new Date(p.creado).getTime() < 14 * 24 * 60 * 60 * 1000;
}

// Carrito: junta los productos que el cliente apartó. Quitar = liberar.
function Carrito({
  items,
  tienda,
  onQuitar,
  onCerrar,
  onAbrirProducto,
}: {
  items: Producto[];
  tienda: TiendaMin;
  onQuitar: (p: Producto) => void;
  onCerrar: () => void;
  onAbrirProducto: (id: string) => void;
}) {
  const supabase = createClient();
  const total = items.reduce((s, p) => s + (p.precio || 0), 0);
  const cel = datosClienteLocal(tienda.id)?.celular ?? "";

  // Cupón de descuento.
  const [codigo, setCodigo] = useState("");
  const [cupon, setCupon] = useState<{ palabra: string; porcentaje: number } | null>(null);
  const [cuponMsg, setCuponMsg] = useState<string | null>(null);
  const [validando, setValidando] = useState(false);

  async function aplicarCupon() {
    const palabra = codigo.trim();
    if (!palabra) return;
    setValidando(true);
    setCuponMsg(null);
    const { data } = await supabase.rpc("validar_cupon", {
      p_tienda: tienda.id,
      p_palabra: palabra,
    });
    const d = data as { valido?: boolean; palabra?: string; porcentaje?: number } | null;
    if (d?.valido) {
      setCupon({ palabra: d.palabra!, porcentaje: Number(d.porcentaje) });
      setCuponMsg(null);
    } else {
      setCupon(null);
      setCuponMsg("Ese cupón no es válido.");
    }
    setValidando(false);
  }

  function quitarCupon() {
    setCupon(null);
    setCodigo("");
    setCuponMsg(null);
  }

  const descuento = cupon ? Math.round((total * cupon.porcentaje) / 100) : 0;
  const totalFinal = total - descuento;

  const waLink =
    tienda.whatsapp && items.length > 0
      ? `https://wa.me/${tienda.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
          "¡Hola! Quiero estos productos que aparté:\n" +
            items.map((p) => `• ${p.nombre} — ${tienda.simbolo}${p.precio}`).join("\n") +
            (cupon
              ? `\nSubtotal: ${tienda.simbolo}${total}\nCupón ${cupon.palabra} (-${cupon.porcentaje}%): -${tienda.simbolo}${descuento}`
              : "") +
            `\nTotal a pagar: ${tienda.simbolo}${totalFinal}` +
            (cel ? `\nMi número: ${cel}` : "") +
            (tienda.datosPago ? `\n\n💳 Datos para pagar:\n${tienda.datosPago}` : "") +
            "\n\n¿Me confirmas disponibilidad y cómo continúo el pago? 🍯",
        )}`
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-cacao/50 sm:items-center sm:p-4"
      onClick={onCerrar}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-[var(--radius-marca)] bg-white sm:rounded-[var(--radius-marca)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-miel-borde px-4 py-3">
          <h3 className="font-titulo text-lg text-durazno">
            Tu carrito 🛒 {items.length > 0 && <span className="text-cacao">({items.length})</span>}
          </h3>
          <button onClick={onCerrar} className="text-cacao">✕</button>
        </div>

        {items.length === 0 ? (
          <div className="px-4 py-10 text-center text-cacao">
            <p className="mb-1 text-3xl">🧺</p>
            <p>Aún no has apartado nada.</p>
            <p className="text-sm">Toca <strong>“La quiero 🍯”</strong> en un producto y aparecerá aquí.</p>
          </div>
        ) : (
          <ul className="flex-1 divide-y divide-miel-borde overflow-y-auto">
            {items.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => onAbrirProducto(p.id)}
                  className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-crema"
                >
                  {p.fotos[0] && (
                    <Image src={urlFoto(p.fotos[0])} alt={p.nombre} fill sizes="64px" className="object-cover" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-producto font-bold text-texto">{p.nombre}</p>
                  <p className="font-bold text-[#7a5414]">{tienda.simbolo}{p.precio}</p>
                  {p.estado === "apartada" && p.hold_expira && (
                    <span className="text-xs">
                      <Reloj expira={p.hold_expira} />
                    </span>
                  )}
                  {p.estado === "apartada_firme" && (
                    <span className="text-xs font-semibold text-[#7a5414]">En firme ✓</span>
                  )}
                </div>
                <button
                  onClick={() => onQuitar(p)}
                  className="shrink-0 rounded-full border border-miel-borde px-3 py-1.5 text-sm font-semibold text-cacao"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}

        {items.length > 0 && (
          <div className="space-y-3 border-t border-miel-borde p-4">
            {/* Cupón de descuento */}
            {cupon ? (
              <div className="flex items-center justify-between rounded-xl bg-verde-mielina/15 px-3 py-2">
                <span className="text-sm text-[#3f5a1c]">
                  Cupón <strong>{cupon.palabra}</strong> aplicado · −{cupon.porcentaje}%
                </span>
                <button onClick={quitarCupon} className="text-sm font-semibold text-cacao underline">
                  Quitar
                </button>
              </div>
            ) : (
              <div>
                <div className="flex gap-2">
                  <input
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    placeholder="¿Tienes un cupón?"
                    className="flex-1 rounded-xl border border-miel-borde bg-crema px-3 py-2 text-sm uppercase placeholder:normal-case"
                  />
                  <button
                    onClick={aplicarCupon}
                    disabled={validando || !codigo.trim()}
                    className="rounded-full bg-sol px-4 py-2 text-sm font-bold text-[#7a5414] disabled:opacity-50"
                  >
                    {validando ? "…" : "Aplicar"}
                  </button>
                </div>
                {cuponMsg && <p className="mt-1 text-xs text-durazno">{cuponMsg}</p>}
              </div>
            )}

            {/* Totales */}
            {cupon && (
              <div className="space-y-0.5 text-sm">
                <div className="flex items-center justify-between text-cacao">
                  <span>Subtotal</span>
                  <span>{tienda.simbolo}{total}</span>
                </div>
                <div className="flex items-center justify-between text-[#3f5a1c]">
                  <span>Descuento ({cupon.porcentaje}%)</span>
                  <span>−{tienda.simbolo}{descuento}</span>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-cacao">Total</span>
              <span className="font-producto text-xl font-bold text-texto">
                {tienda.simbolo}{totalFinal}
              </span>
            </div>

            <p className="text-xs text-cacao">
              Quitar un producto lo libera para que vuelva a quedar disponible.
            </p>
            {waLink && (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-full bg-verde-mielina py-3 text-center font-producto font-bold text-white"
              >
                Pedir por WhatsApp
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function NidoBurbuja({ label, foto, visto, activo, onClick }: { label: string; foto?: string | null; visto: boolean; activo: boolean; onClick: () => void; }) {
  // No visto = anillo de color + "Nuevo"; visto = anillo gris.
  return (
    <button onClick={onClick} className="flex w-[68px] shrink-0 flex-col items-center gap-1">
      <span
        className={`relative flex h-[66px] w-[66px] items-center justify-center rounded-full p-[2.5px] ${
          visto
            ? "bg-miel-borde"
            : "bg-gradient-to-tr from-sol via-durazno to-coral"
        } ${activo ? "ring-2 ring-verde-mielina ring-offset-2" : ""}`}
      >
        <span className="relative h-full w-full overflow-hidden rounded-full border-2 border-white bg-crema">
          {foto && <Image src={urlFoto(foto)} alt={label} fill sizes="64px" className={`object-cover ${visto ? "opacity-80" : ""}`} />}
        </span>
        {!visto && (
          <span className="absolute -bottom-1 rounded-full bg-durazno px-1.5 text-[9px] font-bold text-white shadow">
            Nuevo
          </span>
        )}
      </span>
      <span className={`w-[68px] truncate text-center text-[11px] ${visto ? "text-cacao/60" : "font-semibold text-texto"}`}>
        {label}
      </span>
    </button>
  );
}

function Chip({ children, activo, onClick, color }: { children: React.ReactNode; activo: boolean; onClick: () => void; color?: string; }) {
  return (
    <button
      onClick={onClick}
      style={activo && color ? { backgroundColor: color } : undefined}
      className={`rounded-full px-3 py-1.5 text-sm font-semibold ${activo ? (color ? "text-white" : "bg-verde-mielina text-white") : "border border-miel-borde bg-white text-texto"}`}
    >
      {children}
    </button>
  );
}

// Cuenta regresiva hasta hold_expira.
function Reloj({ expira }: { expira: string }) {
  const [restante, setRestante] = useState(() => +new Date(expira) - Date.now());
  useEffect(() => {
    const t = setInterval(() => setRestante(+new Date(expira) - Date.now()), 1000);
    return () => clearInterval(t);
  }, [expira]);
  if (restante <= 0) return <span className="font-mano text-cacao">por liberarse…</span>;
  const h = Math.floor(restante / 3.6e6);
  const m = Math.floor((restante % 3.6e6) / 6e4);
  const s = Math.floor((restante % 6e4) / 1000);
  return (
    <span className="font-producto font-bold text-durazno">
      ⏳ {h > 0 ? `${h}h ` : ""}{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}

function DetalleProducto({
  producto,
  campos,
  lineas,
  tienda,
  celular,
  esFavorito,
  onFavorito,
  onPedirDatos,
  onCerrar,
}: {
  producto: Producto;
  campos: Campo[];
  lineas: Linea[];
  tienda: TiendaMin;
  celular: string;
  esFavorito: boolean;
  onFavorito: () => void;
  onPedirDatos: (cb: () => void) => void;
  onCerrar: () => void;
}) {
  const supabase = createClient();
  const camposLinea = campos.filter((c) => c.linea_id === producto.linea_id);
  const linea = lineas.find((l) => l.id === producto.linea_id);
  const soyHolder = !!celular && producto.holder_celular === celular;

  const [pos, setPos] = useState<number | null>(null);
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const idRef = useRef(producto.id);

  const refrescarPos = useCallback(async () => {
    if (!celular) return;
    const { data } = await supabase.rpc("mi_posicion", {
      p_producto: idRef.current,
      p_celular: celular,
    });
    setPos((data as number) ?? null);
  }, [supabase, celular]);

  useEffect(() => {
    refrescarPos();
  }, [refrescarPos, producto.estado, producto.holder_celular]);

  async function accion(rpc: string) {
    // Entrada suave: si aún no hay datos, los pedimos y reintentamos al volver.
    const cel = celular || (datosClienteLocal(tienda.id)?.celular ?? "");
    if (!cel) {
      onPedirDatos(() => accion(rpc));
      return;
    }
    setCargando(true);
    setAviso(null);
    const { data } = await supabase.rpc(rpc, {
      p_producto: producto.id,
      p_celular: cel,
    });
    const r = (data as { resultado?: string; posicion?: number })?.resultado;
    if (r === "en_cola") {
      setPos(data.posicion ?? null);
      setAviso(`Estás en la lista de espera, lugar #${data.posicion}.`);
    } else if (r === "no_disponible") {
      setAviso("Ya no está disponible.");
    } else if (r === "apartado") {
      setAviso("¡Apartado para ti! Lo guardamos en tu carrito 🛒");
    } else if (r === "fuera" || r === "liberado") {
      setPos(null);
    }
    setCargando(false);
    await refrescarPos();
  }

  const waLink = tienda.whatsapp
    ? `https://wa.me/${tienda.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`¡Hola! Aparté "${producto.nombre}" (${tienda.simbolo}${producto.precio}). Mi número: ${celular}`)}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-cacao/50 sm:items-center sm:p-4" onClick={onCerrar}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[var(--radius-marca)] bg-white sm:rounded-[var(--radius-marca)]" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <Carrusel fotos={producto.fotos} nombre={producto.nombre} />
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-lg leading-none text-cacao shadow-md backdrop-blur transition hover:bg-white"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-producto text-xl font-bold text-texto">{producto.nombre}</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={onFavorito}
                aria-label={esFavorito ? "Quitar de favoritos" : "Guardar en favoritos"}
                className="text-xl leading-none"
              >
                {esFavorito ? "❤️" : "🤍"}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${ETIQUETA[producto.estado].cls}`}>
              {ETIQUETA[producto.estado].txt}
            </span>
            {producto.estado === "apartada" && producto.hold_expira && (
              <Reloj expira={producto.hold_expira} />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-producto text-lg font-bold text-[#7a5414]">{tienda.simbolo}{producto.precio}</p>
            {textoStock(producto) && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  producto.cantidad === 1
                    ? "bg-durazno/20 text-[#7a3a26]"
                    : "bg-verde-mielina/20 text-[#3f5a1c]"
                }`}
              >
                {textoStock(producto)}
              </span>
            )}
          </div>
          {linea && <p className="text-xs text-cacao">{linea.icono} {linea.nombre}</p>}
          {producto.descripcion && <p className="text-sm text-texto">{producto.descripcion}</p>}

          <ul className="flex flex-wrap gap-2 pt-1">
            {camposLinea.map((c) => {
              const v = producto.atributos?.[c.id];
              if (v == null || v === "") return null;
              return (
                <li key={c.id} className="rounded-full bg-crema px-2 py-1 text-xs text-cacao">
                  <strong>{c.nombre}:</strong> {Array.isArray(v) ? v.join(", ") : String(v)}
                </li>
              );
            })}
          </ul>

          {/* Botón según la relación del cliente con el producto */}
          <div className="space-y-2 pt-2">
            {producto.estado === "disponible" && (
              <button
                disabled={cargando}
                onClick={() => accion("apartar_producto")}
                className="block w-full rounded-full bg-verde-mielina py-3 text-center font-producto font-bold text-white disabled:opacity-60"
              >
                La quiero 🍯
              </button>
            )}

            {soyHolder && (
              <>
                <p className="rounded-xl bg-verde-mielina/15 px-3 py-2 text-center text-sm text-[#3f5a1c]">
                  ¡Está apartada para ti! Contáctanos para concretar.
                </p>
                {waLink && (
                  <a href={waLink} target="_blank" rel="noopener noreferrer" className="block w-full rounded-full bg-sol py-3 text-center font-producto font-bold text-[#7a5414]">
                    Escribir por WhatsApp
                  </a>
                )}
                <button onClick={() => accion("liberar_producto")} disabled={cargando} className="block w-full rounded-full border border-miel-borde py-2.5 text-center text-sm font-semibold text-cacao">
                  Ya no la quiero
                </button>
              </>
            )}

            {!soyHolder && (producto.estado === "apartada" || producto.estado === "apartada_firme") && (
              pos != null ? (
                <>
                  <p className="rounded-xl bg-durazno/15 px-3 py-2 text-center text-sm text-[#7a3a26]">
                    Estás en la lista de espera · lugar <strong>#{pos}</strong>
                  </p>
                  <button onClick={() => accion("salir_cola")} disabled={cargando} className="block w-full rounded-full border border-miel-borde py-2.5 text-center text-sm font-semibold text-cacao">
                    Salir de la lista
                  </button>
                </>
              ) : (
                <button onClick={() => accion("apartar_producto")} disabled={cargando} className="block w-full rounded-full bg-durazno py-3 text-center font-producto font-bold text-white disabled:opacity-60">
                  Apartar en lista de espera
                </button>
              )
            )}

            {(producto.estado === "vendida" || producto.estado === "agotada") && (
              <p className="rounded-xl bg-cacao/15 px-3 py-2 text-center text-sm text-cacao">
                Este producto ya no está disponible.
              </p>
            )}

            {aviso && <p className="text-center text-sm text-durazno">{aviso}</p>}
          </div>

          {/* Pregúntale a la tienda (sin salir del producto) */}
          <PreguntaProducto producto={producto} tienda={tienda} celular={celular} onPedirDatos={onPedirDatos} />
        </div>
      </div>
    </div>
  );
}

// Carrusel de fotos del producto (varios ángulos): swipe + indicadores.
function Carrusel({ fotos, nombre }: { fotos: string[]; nombre: string }) {
  const lista = fotos.length ? fotos : [""];
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  function alDeslizar() {
    const el = ref.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setIdx(Math.min(lista.length - 1, Math.max(0, i)));
  }
  return (
    <div className="relative bg-crema">
      <div
        ref={ref}
        onScroll={alDeslizar}
        className="flex snap-x snap-mandatory overflow-x-auto"
      >
        {lista.map((f, i) => (
          <div key={i} className="relative aspect-square w-full shrink-0 snap-center bg-miel/30">
            {f && (
              <Image
                src={urlFoto(f)}
                alt={`${nombre} ${i + 1}`}
                fill
                sizes="(max-width: 460px) 100vw, 460px"
                className="object-cover"
              />
            )}
          </div>
        ))}
      </div>
      {lista.length > 1 && (
        <>
          <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-xs font-bold text-white">
            {idx + 1}/{lista.length}
          </span>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {lista.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${i === idx ? "bg-white" : "bg-white/50"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Caja para preguntarle algo a la tienda sobre el producto. Se envía sin salir
// del modal; llega a la bandeja del admin (y a su WhatsApp si activa la API).
function PreguntaProducto({
  producto,
  tienda,
  celular,
  onPedirDatos,
}: {
  producto: Producto;
  tienda: TiendaMin;
  celular: string;
  onPedirDatos: (cb: () => void) => void;
}) {
  const supabase = createClient();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);

  async function enviar() {
    const t = texto.trim();
    if (!t) return;
    const cel = celular || (datosClienteLocal(tienda.id)?.celular ?? "");
    if (!cel) {
      // Necesitamos su número para poder responderle por WhatsApp.
      onPedirDatos(() => enviar());
      return;
    }
    setEnviando(true);
    await supabase.rpc("registrar_pregunta", {
      p_tienda: tienda.id,
      p_celular: cel,
      p_producto: producto.id,
      p_texto: t,
    });
    setEnviando(false);
    setEnviada(true);
    setTexto("");
  }

  return (
    <div className="border-t border-miel-borde p-4">
      <p className="mb-2 font-titulo text-durazno">¿Tienes una pregunta?</p>
      {enviada ? (
        <div className="rounded-xl bg-verde-mielina/15 px-3 py-2 text-sm text-[#3f5a1c]">
          ¡Enviada! 🍯 Te responderemos por WhatsApp.
          <button onClick={() => setEnviada(false)} className="ml-2 underline">
            Preguntar otra cosa
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ej. ¿tienes otra talla? ¿está nuevo?"
            className="flex-1 rounded-xl border border-miel-borde bg-crema px-3 py-2 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") enviar();
            }}
          />
          <button
            onClick={enviar}
            disabled={enviando || !texto.trim()}
            className="rounded-full bg-durazno px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {enviando ? "…" : "Enviar"}
          </button>
        </div>
      )}
    </div>
  );
}

function BuscaProducto({ tiendaId }: { tiendaId: string }) {
  const supabase = createClient();
  const [texto, setTexto] = useState("");
  const [enviado, setEnviado] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    const datos = datosClienteLocal(tiendaId);
    await supabase.rpc("registrar_solicitud", {
      p_tienda: tiendaId,
      p_celular: datos?.celular ?? "",
      p_texto: texto.trim(),
    });
    setEnviado(true);
    setTexto("");
  }

  return (
    <form id="busca" onSubmit={enviar} className="scroll-mt-20 rounded-[var(--radius-marca)] border border-dashed border-durazno bg-white p-4">
      <p className="mb-2 font-titulo text-durazno">Dinos qué te gustaría ver en Mamielina 🍯</p>
      <div className="flex gap-2">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej. botitas talla 25, mameluco de algodón…" className="flex-1 rounded-xl border border-miel-borde bg-crema px-3 py-2 text-sm" />
        <button className="rounded-full bg-durazno px-4 py-2 text-sm font-bold text-white">Enviar</button>
      </div>
      {enviado && <p className="mt-2 text-sm text-[#3f5a1c]">¡Gracias! Lo tomamos en cuenta para los próximos Nidos. 🍯</p>}
    </form>
  );
}
