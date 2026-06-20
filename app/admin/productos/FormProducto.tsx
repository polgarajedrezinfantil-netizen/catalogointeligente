"use client";

import { useActionState, useMemo, useState } from "react";
import { SubirFotos } from "@/components/SubirFotos";
import type { Campo, Linea, Nido, Producto } from "@/lib/tipos";
import { type EstadoProd } from "./actions";

const inputCls =
  "rounded-xl border border-miel-borde bg-crema px-3 py-2 outline-none focus:border-verde-mielina";

type Props = {
  tiendaId: string;
  lineas: Linea[];
  campos: Campo[];
  nidos: Nido[];
  gananciaDefault: number; // 0.5 = +50%
  accion: (prev: EstadoProd, fd: FormData) => Promise<EstadoProd>;
  producto?: Producto; // modo edición
  onListo?: () => void;
};

// Formulario de alta/edición de producto. Muestra los campos de la línea
// elegida y sugiere el precio = costo × (1 + % ganancia).
export function FormProducto({
  tiendaId,
  lineas,
  campos,
  nidos,
  gananciaDefault,
  accion,
  producto,
}: Props) {
  const [estado, action, pendiente] = useActionState<EstadoProd, FormData>(
    accion,
    null,
  );
  const [lineaId, setLineaId] = useState(producto?.linea_id ?? lineas[0]?.id ?? "");
  const [costo, setCosto] = useState(producto ? String(producto.costo) : "");
  const [precio, setPrecio] = useState(producto ? String(producto.precio) : "");
  const [precioTocado, setPrecioTocado] = useState(false);

  const camposLinea = useMemo(
    () => campos.filter((c) => c.linea_id === lineaId && !c.archivado),
    [campos, lineaId],
  );

  // Sugerencia de precio cuando cambia el costo (si no lo tocaron a mano).
  function alCambiarCosto(v: string) {
    setCosto(v);
    if (!precioTocado) {
      const n = Number(v);
      if (n > 0) setPrecio((n * (1 + gananciaDefault)).toFixed(2));
    }
  }

  const ganancia = Number(precio) - Number(costo);
  const margen =
    Number(precio) > 0 ? Math.round((ganancia / Number(precio)) * 100) : 0;

  return (
    <form
      action={action}
      className="grid gap-3 rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4 sm:grid-cols-2"
    >
      {producto && <input type="hidden" name="producto_id" value={producto.id} />}

      <label className="text-sm font-semibold text-cacao sm:col-span-2">
        Nombre
        <input
          name="nombre"
          required
          defaultValue={producto?.nombre}
          className={`mt-1 w-full ${inputCls}`}
        />
      </label>

      <label className="text-sm font-semibold text-cacao">
        Línea de venta
        <select
          name="linea_id"
          value={lineaId}
          onChange={(e) => setLineaId(e.target.value)}
          className={`mt-1 w-full ${inputCls}`}
        >
          <option value="">— Sin línea —</option>
          {lineas.map((l) => (
            <option key={l.id} value={l.id}>
              {l.icono} {l.nombre}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-semibold text-cacao">
        Nido
        <select
          name="nido_id"
          defaultValue={producto?.nido_id ?? ""}
          className={`mt-1 w-full ${inputCls}`}
        >
          <option value="">— Sin Nido —</option>
          {nidos.map((n) => (
            <option key={n.id} value={n.id}>
              {n.nombre}
            </option>
          ))}
        </select>
      </label>

      {/* Campos dinámicos de la línea */}
      {camposLinea.length > 0 && (
        <div className="sm:col-span-2 grid gap-3 rounded-xl bg-crema p-3 sm:grid-cols-2">
          {camposLinea.map((c) => (
            <CampoInput key={c.id} campo={c} producto={producto} />
          ))}
        </div>
      )}

      <label className="text-sm font-semibold text-cacao">
        Costo
        <input
          name="costo"
          type="number"
          step="0.01"
          value={costo}
          onChange={(e) => alCambiarCosto(e.target.value)}
          className={`mt-1 w-full ${inputCls}`}
        />
      </label>

      <label className="text-sm font-semibold text-cacao">
        Precio de venta
        <input
          name="precio"
          type="number"
          step="0.01"
          value={precio}
          onChange={(e) => {
            setPrecio(e.target.value);
            setPrecioTocado(true);
          }}
          className={`mt-1 w-full ${inputCls}`}
        />
      </label>

      <div className="sm:col-span-2 text-sm text-cacao">
        Ganancia: <strong className="text-[#3f5a1c]">${ganancia.toFixed(2)}</strong>{" "}
        · Margen: <strong>{margen}%</strong>
      </div>

      <label className="text-sm font-semibold text-cacao">
        Existencias / stock
        <input
          name="cantidad"
          type="number"
          min={0}
          defaultValue={producto?.cantidad ?? 1}
          className={`mt-1 w-full ${inputCls}`}
        />
        <span className="mt-1 block text-xs font-normal text-cacao">
          Cuántas piezas iguales tienes. 1 = pieza única (se muestra “¡Último!”).
        </span>
      </label>

      <label className="text-sm font-semibold text-cacao">
        Para
        <select
          name="genero"
          defaultValue={producto?.genero ?? ""}
          className={`mt-1 w-full ${inputCls}`}
        >
          <option value="">— Sin especificar —</option>
          <option value="nino">👦 Niño</option>
          <option value="nina">👧 Niña</option>
          <option value="unisex">🧒 Unisex</option>
          <option value="mami">🤱 Mami</option>
        </select>
      </label>

      <label className="text-sm font-semibold text-cacao">
        Categoría (opcional)
        <input
          name="categoria"
          defaultValue={producto?.categoria ?? ""}
          className={`mt-1 w-full ${inputCls}`}
        />
      </label>

      <label className="text-sm font-semibold text-cacao sm:col-span-2">
        Descripción
        <textarea
          name="descripcion"
          rows={2}
          defaultValue={producto?.descripcion ?? ""}
          className={`mt-1 w-full ${inputCls}`}
        />
      </label>

      <div className="sm:col-span-2">
        <span className="text-sm font-semibold text-cacao">Fotos reales</span>
        <div className="mt-1">
          <SubirFotos
            name="fotos"
            tiendaId={tiendaId}
            multiple
            inicial={producto?.fotos ?? []}
          />
        </div>
      </div>

      <div className="sm:col-span-2 flex items-center gap-3">
        <button
          disabled={pendiente}
          className="rounded-full bg-verde-mielina px-6 py-2 font-bold text-white disabled:opacity-60"
        >
          {pendiente ? "Guardando…" : producto ? "Guardar cambios" : "Crear producto"}
        </button>
        {estado && (
          <span className={`text-sm ${estado.ok ? "text-[#3f5a1c]" : "text-durazno"}`}>
            {estado.mensaje}
          </span>
        )}
      </div>
    </form>
  );
}

// Renderiza el control adecuado según el tipo de campo.
function CampoInput({ campo, producto }: { campo: Campo; producto?: Producto }) {
  const name = `attr_${campo.id}`;
  const actual = producto?.atributos?.[campo.id];
  const label = (
    <span className="text-sm font-semibold text-cacao">
      {campo.nombre}
      {campo.obligatorio && <span className="text-durazno"> *</span>}
    </span>
  );

  if (campo.tipo === "sino") {
    return (
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name={name}
          value="sí"
          defaultChecked={actual === "sí"}
        />
        {label}
      </label>
    );
  }

  if (campo.tipo === "lista") {
    return (
      <label className="block">
        {label}
        <select
          name={name}
          required={campo.obligatorio}
          defaultValue={(actual as string) ?? ""}
          className={`mt-1 w-full ${inputCls}`}
        >
          <option value="">—</option>
          {campo.opciones.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (campo.tipo === "multi") {
    const actuales = Array.isArray(actual) ? (actual as string[]) : [];
    return (
      <div>
        {label}
        <div className="mt-1 flex flex-wrap gap-2">
          {campo.opciones.map((o) => (
            <label key={o} className="flex items-center gap-1 text-sm text-texto">
              <input
                type="checkbox"
                name={name}
                value={o}
                defaultChecked={actuales.includes(o)}
              />
              {o}
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <label className="block">
      {label}
      <input
        name={name}
        type={campo.tipo === "numero" ? "number" : "text"}
        required={campo.obligatorio}
        defaultValue={(actual as string) ?? ""}
        className={`mt-1 w-full ${inputCls}`}
      />
    </label>
  );
}
