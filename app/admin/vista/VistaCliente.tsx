"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { urlFoto } from "@/lib/fotos";
import { temaStyle, TEMA_DEFAULT, TOKENS_TEMA, type Tema } from "@/lib/tema";
import type { Campo, Producto } from "@/lib/tipos";
import { editarRapido, reordenarProductos, type EstadoRapido } from "../productos/actions";
import { guardarCabeceraColores, type EstadoApariencia } from "../apariencia/actions";

const inputCls =
  "rounded-xl border border-miel-borde bg-crema px-3 py-2 outline-none focus:border-verde-mielina";

const ETIQUETA: Record<string, { txt: string; cls: string }> = {
  apartada: { txt: "Apartada", cls: "bg-durazno text-white" },
  apartada_firme: { txt: "En firme", cls: "bg-sol text-[#7a5414]" },
  vendida: { txt: "Vendida", cls: "bg-cacao text-white" },
  agotada: { txt: "Agotada", cls: "bg-cacao/80 text-white" },
};

function esNuevo(p: Producto) {
  return Date.now() - new Date(p.creado).getTime() < 14 * 24 * 60 * 60 * 1000;
}

const sinAcentos = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// El campo que guarda la talla en la línea de la prenda (Talla/Número/Edad).
function campoTallaDe(campos: Campo[], lineaId: string | null): Campo | null {
  if (!lineaId) return null;
  const deLinea = campos.filter((c) => c.linea_id === lineaId && !c.archivado);
  return (
    deLinea.find((c) => sinAcentos(c.nombre).includes("talla")) ??
    deLinea.find((c) => sinAcentos(c.nombre).includes("numero")) ??
    deLinea.find((c) => sinAcentos(c.nombre).includes("edad")) ??
    null
  );
}

function tallasDe(p: Producto, campo: Campo | null): string[] {
  const v = campo ? p.atributos?.[campo.id] : null;
  if (Array.isArray(v)) return v.map(String);
  return v != null && v !== "" ? [String(v)] : [];
}

type Props = {
  marca: string;
  handle: string | null;
  subtitulo: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  simbolo: string;
  tema: Tema;
  productos: Producto[];
  campos: Campo[];
};

export function VistaCliente(props: Props) {
  const [modo, setModo] = useState<"editar" | "ver">("editar");
  const [items, setItems] = useState<Producto[]>(props.productos);
  const [drag, setDrag] = useState<number | null>(null);
  const [ordenSucio, setOrdenSucio] = useState(false);
  const [guardandoOrden, setGuardandoOrden] = useState(false);
  const [editar, setEditar] = useState<Producto | null>(null);
  // Encabezado y colores editables en vivo.
  const [tema, setTema] = useState<Tema>({ ...TEMA_DEFAULT, ...props.tema });
  const [subtitulo, setSubtitulo] = useState(props.subtitulo);
  const [editarCab, setEditarCab] = useState(false);

  const editando = modo === "editar";
  // En "ver" se oculta lo que el cliente no ve; en "editar" se ve todo.
  const visibles = editando ? items : items.filter((p) => !p.oculto);

  function reordenar(desde: number, hasta: number) {
    if (hasta < 0 || hasta >= items.length || desde === hasta) return;
    const next = [...items];
    const [m] = next.splice(desde, 1);
    next.splice(hasta, 0, m);
    setItems(next);
    setOrdenSucio(true);
  }

  async function guardarOrden() {
    setGuardandoOrden(true);
    const fd = new FormData();
    fd.set("ids", JSON.stringify(items.map((i) => i.id)));
    await reordenarProductos(fd);
    setGuardandoOrden(false);
    setOrdenSucio(false);
  }

  function aplicarEdicion(actualizado: Producto) {
    setItems((arr) => arr.map((p) => (p.id === actualizado.id ? actualizado : p)));
    setEditar(null);
  }

  return (
    <div className="space-y-4">
      {/* Barra de herramientas */}
      <div className="sticky top-0 z-20 -mx-5 flex flex-wrap items-center gap-2 border-b border-miel-borde bg-crema/95 px-5 py-3 backdrop-blur">
        <h1 className="font-titulo text-xl text-durazno">Vista cliente</h1>
        <div className="flex overflow-hidden rounded-full border border-miel-borde">
          <button
            onClick={() => setModo("editar")}
            className={`px-3 py-1.5 text-sm font-bold ${editando ? "bg-verde-mielina text-white" : "bg-white text-texto"}`}
          >
            ✏️ Editar
          </button>
          <button
            onClick={() => setModo("ver")}
            className={`px-3 py-1.5 text-sm font-bold ${!editando ? "bg-verde-mielina text-white" : "bg-white text-texto"}`}
          >
            👁️ Solo ver
          </button>
        </div>
        {editando && ordenSucio && (
          <button
            onClick={guardarOrden}
            disabled={guardandoOrden}
            className="ml-auto rounded-full bg-durazno px-4 py-1.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {guardandoOrden ? "Guardando…" : "Guardar orden"}
          </button>
        )}
      </div>

      {editando && (
        <p className="text-sm text-cacao">
          Arrastra una prenda (o usa ↑↓) para reordenar, y toca ✏️ para editar
          precio, oferta, nombre u ocultarla. En <strong>Solo ver</strong> lo ves
          igual que tu cliente.
        </p>
      )}

      {/* Marco tipo teléfono con el tema de la tienda */}
      <div
        style={temaStyle(tema)}
        className="mx-auto w-full max-w-[460px] overflow-hidden rounded-[var(--radius-marca)] border border-miel-borde bg-white shadow-sm"
      >
        {props.bannerUrl && (
          <div className="relative aspect-[16/7] w-full">
            <Image src={urlFoto(props.bannerUrl)} alt="portada" fill sizes="460px" className="object-cover" />
          </div>
        )}
        {/* Encabezado (editable) */}
        <div className="relative flex items-center gap-2.5 border-b border-miel-borde bg-white/95 px-4 py-2.5">
          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gradient-to-tr from-sol via-durazno to-coral p-[2px]">
            <span className="relative block h-full w-full overflow-hidden rounded-full border-2 border-white bg-crema">
              {props.logoUrl && (
                <Image src={urlFoto(props.logoUrl)} alt="logo" fill sizes="32px" className="object-cover" />
              )}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <p className="font-producto text-base font-bold text-texto">{props.marca}</p>
              {props.handle && <span className="font-mano text-sm text-cacao">· {props.handle}</span>}
            </div>
            {subtitulo && (
              <p className="font-mano text-sm leading-tight text-cacao">{subtitulo}</p>
            )}
          </div>
          {editando && (
            <button
              onClick={() => setEditarCab(true)}
              className="absolute right-2 top-2 rounded-full bg-verde-mielina px-2.5 py-1 text-xs font-bold text-white shadow"
            >
              ✏️ Encabezado y colores
            </button>
          )}
        </div>

        {/* Grid de productos (igual que el catálogo) */}
        <div className="grid grid-cols-2 gap-2.5 bg-crema p-2.5">
          {visibles.map((p) => {
            const idx = items.findIndex((x) => x.id === p.id);
            return (
              <div
                key={p.id}
                draggable={editando}
                onDragStart={() => setDrag(idx)}
                onDragOver={(e) => editando && e.preventDefault()}
                onDrop={() => {
                  if (editando && drag !== null) reordenar(drag, idx);
                  setDrag(null);
                }}
                className={`relative overflow-hidden rounded-2xl border border-miel-borde bg-white ${
                  drag === idx ? "opacity-50" : ""
                } ${p.oculto ? "opacity-60" : ""}`}
              >
                <div className="relative aspect-[4/5] bg-crema">
                  {p.fotos[0] && (
                    <Image src={urlFoto(p.fotos[0])} alt={p.nombre} fill sizes="50vw" className="object-cover" />
                  )}
                  <div className="pointer-events-none absolute left-1.5 top-1.5 flex flex-col items-start gap-1">
                    {p.estado !== "disponible"
                      ? ETIQUETA[p.estado] && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ETIQUETA[p.estado].cls}`}>
                            {ETIQUETA[p.estado].txt}
                          </span>
                        )
                      : esNuevo(p) && (
                          <span className="rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold text-white">🆕 Nuevo</span>
                        )}
                    {p.precio_oferta != null && (
                      <span className="rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold text-white">🏷️ Oferta</span>
                    )}
                    {p.oculto && (
                      <span className="rounded-full bg-cacao px-2 py-0.5 text-[10px] font-bold text-white">🚫 Oculto</span>
                    )}
                  </div>
                  {/* Talla abajo-derecha, como la ve el cliente; si falta y la
                      línea tiene campo de talla, un aviso para capturarla. */}
                  {(() => {
                    const ct = campoTallaDe(props.campos, p.linea_id);
                    const ts = tallasDe(p, ct);
                    if (ts.length) {
                      return (
                        <span className="pointer-events-none absolute bottom-1.5 right-1.5 flex h-7 min-w-7 max-w-[85%] items-center justify-center whitespace-nowrap rounded-full bg-black/30 px-2 text-[10px] font-bold text-white ring-1 ring-white/40 backdrop-blur-sm">
                          {ts.length > 3 ? `${ts.slice(0, 3).join(" · ")}…` : ts.join(" · ")}
                        </span>
                      );
                    }
                    if (editando && ct) {
                      return (
                        <span className="pointer-events-none absolute bottom-1.5 right-1.5 flex h-7 items-center justify-center rounded-full border border-dashed border-white/80 bg-black/20 px-2 text-[10px] font-bold text-white backdrop-blur-sm">
                          + talla
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
                <div className="px-2.5 py-2">
                  <p className="truncate text-xs font-semibold text-texto">{p.nombre}</p>
                  {p.precio_oferta != null ? (
                    <p className="font-producto text-base font-bold text-coral">
                      {props.simbolo}{p.precio_oferta}
                      <span className="ml-1 text-xs font-semibold text-cacao line-through">{props.simbolo}{p.precio}</span>
                    </p>
                  ) : (
                    <p className="font-producto text-base font-bold text-[#7a5414]">{props.simbolo}{p.precio}</p>
                  )}
                </div>

                {/* Controles de edición */}
                {editando && (
                  <div className="flex items-center gap-1 border-t border-miel-borde bg-white px-1.5 py-1.5">
                    <span className="cursor-grab px-1 text-cacao" title="Arrastrar">⠿</span>
                    <button
                      onClick={() => reordenar(idx, idx - 1)}
                      disabled={idx === 0}
                      aria-label="Subir"
                      className="rounded border border-miel-borde px-1.5 text-sm disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => reordenar(idx, idx + 1)}
                      disabled={idx === items.length - 1}
                      aria-label="Bajar"
                      className="rounded border border-miel-borde px-1.5 text-sm disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => setEditar(p)}
                      className="ml-auto rounded-full bg-verde-mielina px-2.5 py-1 text-xs font-bold text-white"
                    >
                      ✏️ Editar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {visibles.length === 0 && (
          <p className="bg-crema py-10 text-center text-cacao">Aún no hay productos.</p>
        )}
      </div>

      {editar && (
        <EdicionRapida
          p={editar}
          simbolo={props.simbolo}
          campoTalla={campoTallaDe(props.campos, editar.linea_id)}
          onGuardado={aplicarEdicion}
          onCerrar={() => setEditar(null)}
        />
      )}

      {editarCab && (
        <EdicionCabecera
          tema={tema}
          setTema={setTema}
          subtitulo={subtitulo}
          setSubtitulo={setSubtitulo}
          onCerrar={() => setEditarCab(false)}
        />
      )}
    </div>
  );
}

// Hoja de edición de encabezado (subtítulo) y colores, con recolor en vivo.
function EdicionCabecera({
  tema,
  setTema,
  subtitulo,
  setSubtitulo,
  onCerrar,
}: {
  tema: Tema;
  setTema: (t: Tema) => void;
  subtitulo: string;
  setSubtitulo: (s: string) => void;
  onCerrar: () => void;
}) {
  const [pend, setPend] = useState(false);
  const [estado, setEstado] = useState<EstadoApariencia>(null);

  async function guardar() {
    setPend(true);
    setEstado(null);
    const fd = new FormData();
    fd.set("tema", JSON.stringify(tema));
    fd.set("subtitulo", subtitulo);
    const res = await guardarCabeceraColores(fd);
    setPend(false);
    setEstado(res);
    if (res?.ok) setTimeout(onCerrar, 700);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-cacao/50 sm:items-center sm:p-4" onClick={onCerrar}>
      <div
        className="max-h-[85vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-[var(--radius-marca)] bg-white p-4 sm:rounded-[var(--radius-marca)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-titulo text-lg text-durazno">Encabezado y colores</h3>
          <button onClick={onCerrar} aria-label="Cerrar" className="text-cacao">✕</button>
        </div>

        <label className="block text-sm font-semibold text-cacao">
          Eslogan / subtítulo
          <input
            value={subtitulo}
            onChange={(e) => setSubtitulo(e.target.value)}
            placeholder="miel & protección"
            className={`mt-1 w-full ${inputCls}`}
          />
        </label>

        <div className="flex items-center justify-between pt-1">
          <span className="text-sm font-semibold text-cacao">Colores</span>
          <button
            type="button"
            onClick={() => setTema({ ...TEMA_DEFAULT })}
            className="rounded-full border border-miel-borde px-3 py-1 text-xs font-semibold"
          >
            Restaurar marca
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {TOKENS_TEMA.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <input
                type="color"
                value={tema[key] ?? "#000000"}
                onChange={(e) => setTema({ ...tema, [key]: e.target.value })}
                className="h-8 w-9 shrink-0 rounded-lg border border-miel-borde"
                aria-label={label}
              />
              <span className="truncate text-xs text-cacao">{label}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-cacao">Los colores se ven en vivo en el catálogo de arriba.</p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button onClick={guardar} disabled={pend} className="rounded-full bg-verde-mielina px-6 py-2 font-bold text-white disabled:opacity-60">
            {pend ? "Guardando…" : "Guardar"}
          </button>
          {estado && (
            <span className={`text-sm ${estado.ok ? "text-[#3f5a1c]" : "text-durazno"}`}>{estado.mensaje}</span>
          )}
        </div>
        <p className="text-xs text-cacao">
          Más opciones (logo, banner, descripción, redes):{" "}
          <Link href="/admin/apariencia" className="font-semibold underline">Apariencia</Link>
          {" · "}
          <Link href="/admin/configuracion" className="font-semibold underline">Configuración</Link>
        </p>
      </div>
    </div>
  );
}

// Hoja inferior de edición rápida.
function EdicionRapida({
  p,
  simbolo,
  campoTalla,
  onGuardado,
  onCerrar,
}: {
  p: Producto;
  simbolo: string;
  campoTalla: Campo | null;
  onGuardado: (p: Producto) => void;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(p.nombre);
  const [precio, setPrecio] = useState(String(p.precio));
  const [oferta, setOferta] = useState(p.precio_oferta != null ? String(p.precio_oferta) : "");
  const [talla, setTalla] = useState(tallasDe(p, campoTalla).join(", "));
  const [oculto, setOculto] = useState(p.oculto);
  const [pend, setPend] = useState(false);
  const [estado, setEstado] = useState<EstadoRapido>(null);

  async function guardar() {
    setPend(true);
    setEstado(null);
    const fd = new FormData();
    fd.set("producto_id", p.id);
    fd.set("nombre", nombre);
    fd.set("precio", precio);
    fd.set("precio_oferta", oferta);
    if (oculto) fd.set("oculto", "on");
    if (campoTalla) {
      fd.set("talla_campo", campoTalla.id);
      fd.set("talla", talla);
    }
    const res = await editarRapido(fd);
    setPend(false);
    if (res?.ok) {
      // Refleja la talla también en la tarjeta local.
      let atributos = p.atributos;
      if (campoTalla) {
        const vals = talla.split(",").map((s) => s.trim()).filter(Boolean);
        atributos = { ...(p.atributos ?? {}) };
        if (vals.length === 0) delete atributos[campoTalla.id];
        else atributos[campoTalla.id] = vals.length > 1 ? vals : vals[0];
      }
      onGuardado({
        ...p,
        nombre,
        precio: Number(precio),
        precio_oferta: oferta === "" ? null : Number(oferta),
        oculto,
        atributos,
      });
    } else {
      setEstado(res);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-cacao/50 sm:items-center sm:p-4" onClick={onCerrar}>
      <div
        className="w-full max-w-md space-y-3 rounded-t-[var(--radius-marca)] bg-white p-4 sm:rounded-[var(--radius-marca)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-titulo text-lg text-durazno">Editar prenda</h3>
          <button onClick={onCerrar} aria-label="Cerrar" className="text-cacao">✕</button>
        </div>

        <label className="block text-sm font-semibold text-cacao">
          Nombre
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={`mt-1 w-full ${inputCls}`} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-semibold text-cacao">
            Precio
            <input type="number" step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} className={`mt-1 w-full ${inputCls}`} />
          </label>
          <label className="block text-sm font-semibold text-cacao">
            Oferta ({simbolo})
            <input type="number" step="0.01" value={oferta} onChange={(e) => setOferta(e.target.value)} placeholder="—" className={`mt-1 w-full ${inputCls}`} />
          </label>
        </div>
        {campoTalla && (
          <label className="block text-sm font-semibold text-cacao">
            {campoTalla.nombre}
            <input
              value={talla}
              onChange={(e) => setTalla(e.target.value)}
              placeholder="Ej. 6-9m (varias: 4, 6, 8)"
              className={`mt-1 w-full ${inputCls}`}
            />
            <span className="mt-0.5 block text-xs font-normal">
              Sale en el círculo de la tarjeta y en el detalle.
            </span>
          </label>
        )}
        <label className="flex items-center gap-2 text-sm font-semibold text-texto">
          <input type="checkbox" checked={oculto} onChange={(e) => setOculto(e.target.checked)} className="accent-verde-mielina" />
          Ocultar del catálogo
        </label>

        {estado && !estado.ok && <p className="text-sm text-durazno">{estado.mensaje}</p>}

        <div className="flex items-center gap-3 pt-1">
          <button onClick={guardar} disabled={pend} className="rounded-full bg-verde-mielina px-6 py-2 font-bold text-white disabled:opacity-60">
            {pend ? "Guardando…" : "Guardar"}
          </button>
          <Link href="/admin/productos" className="text-sm font-semibold text-cacao underline">
            Editar completo (fotos, tallas…) →
          </Link>
        </div>
      </div>
    </div>
  );
}
