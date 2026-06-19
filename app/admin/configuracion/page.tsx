import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Campo, Linea, Tienda } from "@/lib/tipos";
import { TIPOS_CAMPO } from "@/lib/tipos";
import {
  guardarConfigGeneral,
  crearLinea,
  actualizarLinea,
  archivarLinea,
  moverLinea,
  crearCampo,
  actualizarCampo,
  archivarCampo,
  crearCupon,
  alternarCupon,
  borrarCupon,
} from "./actions";

type Cupon = {
  id: string;
  palabra: string;
  porcentaje: number;
  activo: boolean;
};

const inputCls =
  "rounded-xl border border-miel-borde bg-crema px-3 py-2 outline-none focus:border-verde-mielina";

export default async function ConfiguracionPage() {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) {
    return (
      <p className="text-cacao">
        Esta sección es para administradores de una tienda.
      </p>
    );
  }

  const supabase = await createClient();
  const [
    { data: tiendaData },
    { data: lineasData },
    { data: camposData },
    { data: cuponesData },
  ] = await Promise.all([
    supabase.from("tiendas").select("*").eq("id", perfil.tienda_id).single(),
    supabase
      .from("lineas_de_venta")
      .select("*")
      .eq("tienda_id", perfil.tienda_id)
      .order("orden"),
    supabase
      .from("campos_linea")
      .select("*")
      .eq("tienda_id", perfil.tienda_id)
      .order("orden"),
    supabase
      .from("cupones")
      .select("id, palabra, porcentaje, activo")
      .eq("tienda_id", perfil.tienda_id)
      .order("creado", { ascending: false }),
  ]);

  const tienda = tiendaData as Tienda;
  const lineas = (lineasData ?? []) as Linea[];
  const campos = (camposData ?? []) as Campo[];
  const cupones = (cuponesData ?? []) as Cupon[];

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="font-titulo text-2xl text-durazno">Configuración</h1>

      {/* ---------- General ---------- */}
      <section className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-5">
        <h2 className="mb-4 font-titulo text-lg text-coral">General</h2>
        <form action={guardarConfigGeneral} className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-cacao">
            Nombre de la tienda
            <input
              name="nombre"
              defaultValue={tienda.nombre}
              className={`mt-1 w-full ${inputCls}`}
            />
          </label>
          <label className="text-sm font-semibold text-cacao">
            WhatsApp de contacto
            <input
              name="whatsapp"
              defaultValue={tienda.whatsapp ?? ""}
              placeholder="52155..."
              className={`mt-1 w-full ${inputCls}`}
            />
          </label>
          <label className="text-sm font-semibold text-cacao">
            Caducidad del apartado (horas)
            <input
              name="hold_horas"
              type="number"
              min={1}
              defaultValue={tienda.hold_horas}
              className={`mt-1 w-full ${inputCls}`}
            />
          </label>
          <label className="text-sm font-semibold text-cacao">
            % de ganancia por defecto
            <input
              name="ganancia_pct"
              type="number"
              min={0}
              step={1}
              defaultValue={Math.round(tienda.ganancia_default * 100)}
              className={`mt-1 w-full ${inputCls}`}
            />
          </label>
          <label className="text-sm font-semibold text-cacao">
            Precio general por defecto (opcional)
            <input
              name="precio_general"
              type="number"
              step="0.01"
              defaultValue={tienda.precio_general_default ?? ""}
              className={`mt-1 w-full ${inputCls}`}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-semibold text-cacao">
              Moneda
              <input
                name="moneda"
                defaultValue={tienda.moneda}
                className={`mt-1 w-full ${inputCls}`}
              />
            </label>
            <label className="text-sm font-semibold text-cacao">
              Símbolo
              <input
                name="etiqueta_precio"
                defaultValue={tienda.etiqueta_precio}
                className={`mt-1 w-full ${inputCls}`}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-cacao">
            <input
              type="checkbox"
              name="lista_espera_global"
              defaultChecked={tienda.lista_espera_global}
            />
            Lista de espera activa (global)
          </label>
          <label className="flex items-center gap-2 text-sm text-cacao">
            <input
              type="checkbox"
              name="whatsapp_api_activa"
              defaultChecked={tienda.whatsapp_api_activa}
            />
            Usar API de WhatsApp Business
          </label>
          <label className="text-sm font-semibold text-cacao sm:col-span-2">
            Datos para pagar (se adjuntan al pedido por WhatsApp)
            <textarea
              name="datos_pago"
              rows={3}
              defaultValue={tienda.datos_pago ?? ""}
              placeholder={"Ej. Transferencia BBVA\nCLABE 0123 4567 8901 2345 67\nA nombre de Mamielina\nO link de pago: https://mpago.la/..."}
              className={`mt-1 w-full ${inputCls}`}
            />
            <span className="mt-1 block text-xs font-normal text-cacao">
              Pon tu CLABE/transferencia, un link de cobro (Mercado Pago/PayPal) o tu CoDi. El cliente lo verá al pedir por WhatsApp.
            </span>
          </label>
          <div className="sm:col-span-2">
            <button className="rounded-full bg-verde-mielina px-6 py-2 font-bold text-white">
              Guardar configuración
            </button>
          </div>
        </form>
      </section>

      {/* ---------- Líneas de venta ---------- */}
      <section className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-5">
        <h2 className="mb-1 font-titulo text-lg text-coral">Líneas de venta</h2>
        <p className="mb-4 text-sm text-cacao">
          Cada línea (ej. Ropa, Calzado) tiene sus propios campos.
        </p>

        {/* Alta de línea */}
        <form
          action={crearLinea}
          className="mb-5 flex flex-wrap items-end gap-2 border-b border-miel-borde pb-5"
        >
          <input name="nombre" required placeholder="Nombre" className={inputCls} />
          <input
            name="icono"
            defaultValue="🧺"
            className={`${inputCls} w-16 text-center`}
          />
          <input
            name="color"
            type="color"
            defaultValue="#A6C972"
            className="h-10 w-12 rounded-lg border border-miel-borde"
          />
          <button className="rounded-full bg-durazno px-4 py-2 font-bold text-white">
            Agregar línea
          </button>
        </form>

        {/* Lista de líneas con sus campos */}
        <div className="space-y-6">
          {lineas.map((l, idx) => {
            const camposDeLinea = campos.filter((c) => c.linea_id === l.id);
            return (
              <div
                key={l.id}
                className={`rounded-xl border p-4 ${
                  l.archivada
                    ? "border-cacao/30 bg-cacao/5 opacity-70"
                    : "border-miel-borde"
                }`}
                style={{ borderLeft: `6px solid ${l.color}` }}
              >
                {/* Editar línea */}
                <div className="flex flex-wrap items-center gap-2">
                  <form
                    action={actualizarLinea}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="linea_id" value={l.id} />
                    <input
                      name="icono"
                      defaultValue={l.icono}
                      className={`${inputCls} w-14 text-center`}
                    />
                    <input
                      name="nombre"
                      defaultValue={l.nombre}
                      className={`${inputCls} font-producto font-bold`}
                    />
                    <input
                      name="color"
                      type="color"
                      defaultValue={l.color}
                      className="h-9 w-10 rounded-lg border border-miel-borde"
                    />
                    <button className="rounded-full border border-miel-borde px-3 py-1 text-sm font-semibold">
                      Guardar
                    </button>
                  </form>

                  <div className="ml-auto flex items-center gap-1">
                    <FormBtn
                      action={moverLinea}
                      fields={{ linea_id: l.id, dir: "arriba" }}
                      disabled={idx === 0}
                      label="↑"
                    />
                    <FormBtn
                      action={moverLinea}
                      fields={{ linea_id: l.id, dir: "abajo" }}
                      disabled={idx === lineas.length - 1}
                      label="↓"
                    />
                    <FormBtn
                      action={archivarLinea}
                      fields={{ linea_id: l.id, archivada: String(l.archivada) }}
                      label={l.archivada ? "Restaurar" : "Archivar"}
                    />
                  </div>
                </div>

                {/* Campos de la línea */}
                <div className="mt-4 space-y-2">
                  {camposDeLinea.map((c) => (
                    <div
                      key={c.id}
                      className={`flex flex-wrap items-center gap-2 rounded-lg bg-crema px-2 py-2 ${
                        c.archivado ? "opacity-50" : ""
                      }`}
                    >
                    <form
                      action={actualizarCampo}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input type="hidden" name="campo_id" value={c.id} />
                      <input
                        name="nombre"
                        defaultValue={c.nombre}
                        className={`${inputCls} w-32`}
                      />
                      <select
                        name="tipo"
                        defaultValue={c.tipo}
                        className={`${inputCls} text-sm`}
                      >
                        {TIPOS_CAMPO.map((t) => (
                          <option key={t.valor} value={t.valor}>
                            {t.etiqueta}
                          </option>
                        ))}
                      </select>
                      <input
                        name="opciones"
                        defaultValue={c.opciones.join(", ")}
                        placeholder="opciones (coma)"
                        className={`${inputCls} flex-1 text-sm`}
                      />
                      <label className="flex items-center gap-1 text-xs text-cacao">
                        <input
                          type="checkbox"
                          name="obligatorio"
                          defaultChecked={c.obligatorio}
                        />
                        oblig.
                      </label>
                      <label className="flex items-center gap-1 text-xs text-cacao">
                        <input
                          type="checkbox"
                          name="es_filtro"
                          defaultChecked={c.es_filtro}
                        />
                        filtro
                      </label>
                      <button className="rounded-full border border-miel-borde px-2 py-1 text-xs font-semibold">
                        Guardar
                      </button>
                    </form>
                    <FormBtn
                      action={archivarCampo}
                      fields={{
                        campo_id: c.id,
                        archivado: String(c.archivado),
                      }}
                      label={c.archivado ? "Restaurar" : "Quitar"}
                      small
                    />
                    </div>
                  ))}

                  {/* Alta de campo */}
                  <form
                    action={crearCampo}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-miel-borde px-2 py-2"
                  >
                    <input type="hidden" name="linea_id" value={l.id} />
                    <input
                      name="nombre"
                      required
                      placeholder="Nuevo campo"
                      className={`${inputCls} w-32`}
                    />
                    <select name="tipo" defaultValue="texto" className={`${inputCls} text-sm`}>
                      {TIPOS_CAMPO.map((t) => (
                        <option key={t.valor} value={t.valor}>
                          {t.etiqueta}
                        </option>
                      ))}
                    </select>
                    <input
                      name="opciones"
                      placeholder="opciones (coma)"
                      className={`${inputCls} flex-1 text-sm`}
                    />
                    <label className="flex items-center gap-1 text-xs text-cacao">
                      <input type="checkbox" name="obligatorio" /> oblig.
                    </label>
                    <label className="flex items-center gap-1 text-xs text-cacao">
                      <input type="checkbox" name="es_filtro" /> filtro
                    </label>
                    <button className="rounded-full bg-verde-mielina px-3 py-1 text-xs font-bold text-white">
                      + Campo
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
          {lineas.length === 0 && (
            <p className="text-cacao">
              Aún no tienes líneas. Agrega la primera arriba.
            </p>
          )}
        </div>
      </section>

      {/* ---------- Cupones de descuento ---------- */}
      <section className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-5">
        <h2 className="mb-1 font-titulo text-lg text-coral">Cupones de descuento</h2>
        <p className="mb-4 text-sm text-cacao">
          Define una <strong>palabra</strong> y su <strong>% de descuento</strong>. El
          cliente la escribe en su carrito y se aplica el descuento. No distingue
          mayúsculas ni espacios.
        </p>

        <form action={crearCupon} className="mb-4 flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold text-cacao">
            Palabra / clave
            <input
              name="palabra"
              required
              placeholder="Ej. MAMIELINA10"
              className={`mt-1 block w-48 ${inputCls}`}
            />
          </label>
          <label className="text-sm font-semibold text-cacao">
            % de descuento
            <input
              name="porcentaje"
              type="number"
              min={1}
              max={100}
              step="1"
              required
              placeholder="10"
              className={`mt-1 block w-28 ${inputCls}`}
            />
          </label>
          <button className="rounded-full bg-verde-mielina px-5 py-2 font-bold text-white">
            Crear cupón
          </button>
        </form>

        <div className="divide-y divide-miel-borde">
          {cupones.map((c) => (
            <div key={c.id} className="flex items-center gap-3 py-2">
              <span className="rounded-lg bg-crema px-2 py-1 font-producto font-bold tracking-wide text-texto">
                {c.palabra}
              </span>
              <span className="font-bold text-[#3f5a1c]">-{c.porcentaje}%</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  c.activo ? "bg-verde-mielina text-white" : "bg-cacao/20 text-cacao"
                }`}
              >
                {c.activo ? "Activo" : "Inactivo"}
              </span>
              <div className="ml-auto flex gap-2">
                <FormBtn
                  action={alternarCupon}
                  fields={{ cupon_id: c.id, activo: String(c.activo) }}
                  label={c.activo ? "Desactivar" : "Activar"}
                  small
                />
                <FormBtn
                  action={borrarCupon}
                  fields={{ cupon_id: c.id }}
                  label="Borrar"
                  small
                />
              </div>
            </div>
          ))}
          {cupones.length === 0 && (
            <p className="py-2 text-cacao">Aún no tienes cupones. Crea el primero arriba.</p>
          )}
        </div>
      </section>
    </div>
  );
}

// Botón que envía una mini-form con campos ocultos (para acciones de 1 clic).
function FormBtn({
  action,
  fields,
  label,
  disabled,
  small,
}: {
  action: (fd: FormData) => Promise<void>;
  fields: Record<string, string>;
  label: string;
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <form action={action}>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button
        disabled={disabled}
        className={`rounded-full border border-miel-borde font-semibold disabled:opacity-30 ${
          small ? "px-2 py-1 text-xs" : "px-3 py-1 text-sm"
        }`}
      >
        {label}
      </button>
    </form>
  );
}
