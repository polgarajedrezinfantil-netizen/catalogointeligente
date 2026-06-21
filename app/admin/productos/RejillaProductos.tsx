"use client";

import { useState } from "react";
import Image from "next/image";
import { urlFoto } from "@/lib/fotos";
import type { Campo, Linea, Nido, Producto, EstadoProducto } from "@/lib/tipos";
import { FormProducto } from "./FormProducto";
import {
  actualizarProducto,
  borrarProducto,
  duplicarProducto,
  alternarOculto,
  confirmarApartado,
  venderProducto,
  liberarApartado,
  agotarProducto,
} from "./actions";

const ETIQUETA: Record<EstadoProducto, { txt: string; cls: string }> = {
  disponible: { txt: "Disponible", cls: "bg-verde-mielina/30 text-[#3f5a1c]" },
  apartada: { txt: "Apartada", cls: "bg-durazno/30 text-[#7a3a26]" },
  apartada_firme: { txt: "En firme", cls: "bg-sol/40 text-[#7a5414]" },
  vendida: { txt: "Vendida", cls: "bg-cacao/30 text-cacao" },
  agotada: { txt: "Agotada", cls: "bg-cacao/20 text-cacao" },
};

function wa(celular: string | null, texto: string) {
  if (!celular) return "#";
  return `https://wa.me/${celular.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;
}

type Cola = { producto_id: string; celular: string; posicion: number };

type Props = {
  tiendaId: string;
  lineas: Linea[];
  campos: Campo[];
  nidos: Nido[];
  gananciaDefault: number;
  simbolo: string;
  productos: Producto[];
  cola: Cola[];
};

export function RejillaProductos(props: Props) {
  const [abierto, setAbierto] = useState<Producto | null>(null);
  const [confirmCerrar, setConfirmCerrar] = useState(false);

  function cerrar() {
    setAbierto(null);
    setConfirmCerrar(false);
  }

  return (
    <div>
      {/* Cuadrícula de miniaturas (la foto manda) */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
        {props.productos.map((p) => {
          const et = ETIQUETA[p.estado];
          return (
            <button
              key={p.id}
              onClick={() => setAbierto(p)}
              className={`relative overflow-hidden rounded-2xl border border-miel-borde bg-white text-left transition hover:shadow-md ${
                p.oculto ? "opacity-60" : ""
              }`}
            >
              <div className="relative aspect-[4/5] bg-crema">
                {p.fotos[0] && (
                  <Image src={urlFoto(p.fotos[0])} alt={p.nombre} fill sizes="25vw" className="object-cover" />
                )}
                <div className="pointer-events-none absolute left-1.5 top-1.5 flex flex-col items-start gap-1">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${et.cls}`}>{et.txt}</span>
                  {p.oculto && (
                    <span className="rounded-full bg-cacao px-2 py-0.5 text-[10px] font-bold text-white">🚫 Oculto</span>
                  )}
                  {p.precio_oferta != null && (
                    <span className="rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold text-white">🏷️ Oferta</span>
                  )}
                </div>
              </div>
              <div className="px-2 py-1.5">
                <p className="truncate text-xs font-semibold text-texto">{p.nombre}</p>
                <p className="text-xs font-bold text-[#7a5414]">
                  {props.simbolo}
                  {p.precio_oferta ?? p.precio}
                </p>
              </div>
            </button>
          );
        })}
      </div>
      {props.productos.length === 0 && <p className="text-cacao">Aún no hay productos.</p>}

      {/* Modal de edición */}
      {abierto && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-cacao/50 p-0 sm:p-4">
          <div className="relative my-0 w-full max-w-2xl rounded-none bg-crema p-4 sm:my-4 sm:rounded-[var(--radius-marca)]">
            {/* Encabezado del modal */}
            <div className="sticky top-0 z-10 -mx-4 mb-3 flex items-center gap-2 border-b border-miel-borde bg-crema/95 px-4 py-2 backdrop-blur">
              <h2 className="flex-1 truncate font-titulo text-lg text-durazno">{abierto.nombre}</h2>
              <span className={`rounded-full px-2 py-0.5 text-xs ${ETIQUETA[abierto.estado].cls}`}>
                {ETIQUETA[abierto.estado].txt}
              </span>
              <button
                onClick={() => setConfirmCerrar(true)}
                aria-label="Cerrar"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-miel-borde bg-white text-cacao"
              >
                ✕
              </button>
            </div>

            {/* Apartado: holder y cola */}
            {abierto.holder_celular && (
              <p className="mb-2 text-sm text-durazno">
                Apartada por:{" "}
                <a href={wa(abierto.holder_celular, `Hola, sobre tu apartado de "${abierto.nombre}".`)} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                  {abierto.holder_celular}
                </a>
              </p>
            )}

            {/* Formulario de edición */}
            <FormProducto
              tiendaId={props.tiendaId}
              lineas={props.lineas}
              campos={props.campos}
              nidos={props.nidos}
              gananciaDefault={props.gananciaDefault}
              accion={actualizarProducto}
              producto={abierto}
              formId={`fp-${abierto.id}`}
              onListo={cerrar}
            />

            {/* Apartado + gestión */}
            <div className="mt-3 flex flex-wrap items-center gap-1 rounded-xl border border-miel-borde bg-white p-3">
              {abierto.estado === "apartada" && (
                <Btn action={confirmarApartado} id={abierto.id} label="Confirmar (en firme)" />
              )}
              {(abierto.estado === "apartada" || abierto.estado === "apartada_firme") && (
                <Btn action={liberarApartado} id={abierto.id} label="Liberar → siguiente" />
              )}
              {abierto.estado !== "vendida" && abierto.estado !== "agotada" && (
                <form action={venderProducto} className="flex items-center gap-1">
                  <input type="hidden" name="producto_id" value={abierto.id} />
                  <input name="precio_final" type="number" step="0.01" placeholder={`${abierto.precio}`} className="w-20 rounded-lg border border-miel-borde bg-crema px-2 py-1 text-xs" />
                  <button className="rounded-full bg-verde-mielina px-2.5 py-1 text-xs font-bold text-white">Vender</button>
                </form>
              )}
              {abierto.estado !== "agotada" && <Btn action={agotarProducto} id={abierto.id} label="Agotada" />}
              <Btn action={duplicarProducto} id={abierto.id} label="📑 Duplicar" />
              <form action={alternarOculto}>
                <input type="hidden" name="producto_id" value={abierto.id} />
                <input type="hidden" name="oculto" value={String(abierto.oculto)} />
                <button className="rounded-full border border-miel-borde px-2.5 py-1 text-xs font-semibold text-cacao">
                  {abierto.oculto ? "👁️ Mostrar" : "🚫 Ocultar"}
                </button>
              </form>
              <form action={borrarProducto} onSubmit={(e) => { if (!confirm(`¿Eliminar "${abierto.nombre}"? No se puede deshacer.`)) e.preventDefault(); }}>
                <input type="hidden" name="producto_id" value={abierto.id} />
                <button className="rounded-full border border-durazno px-2.5 py-1 text-xs font-bold text-durazno">🗑️ Eliminar</button>
              </form>
            </div>
          </div>

          {/* Confirmación al cerrar con la X */}
          {confirmCerrar && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-cacao/50 p-4">
              <div className="w-full max-w-xs space-y-3 rounded-[var(--radius-marca)] bg-white p-4 text-center">
                <p className="font-semibold text-texto">¿Quieres guardar los cambios antes de cerrar?</p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      const f = document.getElementById(`fp-${abierto.id}`) as HTMLFormElement | null;
                      f?.requestSubmit();
                      setConfirmCerrar(false);
                    }}
                    className="rounded-full bg-verde-mielina py-2 font-bold text-white"
                  >
                    Guardar cambios
                  </button>
                  <button onClick={cerrar} className="rounded-full border border-miel-borde py-2 font-semibold text-texto">
                    Cerrar sin guardar
                  </button>
                  <button onClick={() => setConfirmCerrar(false)} className="text-sm text-cacao">
                    Seguir editando
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Btn({ action, id, label }: { action: (fd: FormData) => Promise<void>; id: string; label: string }) {
  return (
    <form action={action}>
      <input type="hidden" name="producto_id" value={id} />
      <button className="rounded-full border border-miel-borde px-2.5 py-1 text-xs font-semibold text-cacao">{label}</button>
    </form>
  );
}
