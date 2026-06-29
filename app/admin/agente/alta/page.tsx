import Link from "next/link";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { guardarConfigAgente } from "./actions";
import { SelectorTienda } from "./SelectorTienda";

export const dynamic = "force-dynamic";

const I = "w-full rounded-xl border border-miel-borde bg-white px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-durazno/40";
const L = "mb-1 block text-xs font-semibold uppercase tracking-wide text-cacao";

type Marca = { nombre?: string; asesora?: string; voz?: string; emoji_max?: number; presentacion?: string };
type Origen = { ciudad?: string; zonas_envio?: Record<string, string> };

export default async function AltaAgentePage({
  searchParams,
}: {
  searchParams: Promise<{ tienda?: string }>;
}) {
  const perfil = await getPerfil();
  if (!perfil) return <p className="text-cacao">No autorizado.</p>;
  const esSuper = perfil.rol === "superadmin";
  if (!esSuper && !perfil.tienda_id) {
    return <p className="text-cacao">Esta sección es para administradores de una tienda.</p>;
  }

  const sp = await searchParams;
  const supabase = await createClient();

  let tiendas: { id: string; nombre: string; slug: string }[] = [];
  if (esSuper) {
    const { data } = await supabase.from("tiendas").select("id, nombre, slug").order("nombre");
    tiendas = data ?? [];
  }
  const tiendaId = esSuper ? (sp.tienda ?? "") : perfil.tienda_id!;

  // Precarga de config + canal + nombre de la tienda
  let cfg: { activa?: boolean; marca?: Marca; guardarrailes_extra?: string[]; origen?: Origen; tallas?: string } | null = null;
  let waPnid = "";
  let tiendaNombre = "";
  let secretos: { mp_conectado?: boolean } | null = null;
  if (tiendaId) {
    const [{ data: c }, { data: canal }, { data: t }, { data: sec }] = await Promise.all([
      supabase.from("agente_config").select("activa, marca, guardarrailes_extra, origen, tallas").eq("tienda_id", tiendaId).maybeSingle(),
      supabase.from("agente_canales").select("external_id").eq("tienda_id", tiendaId).eq("tipo", "whatsapp").maybeSingle(),
      supabase.from("tiendas").select("nombre, slug").eq("id", tiendaId).maybeSingle(),
      supabase.from("agente_secretos").select("mp_conectado").eq("tienda_id", tiendaId).maybeSingle(),
    ]);
    cfg = c;
    waPnid = (canal?.external_id as string) ?? "";
    tiendaNombre = (t?.nombre as string) ?? "";
    secretos = sec;
  }

  const m = (cfg?.marca ?? {}) as Marca;
  const o = (cfg?.origen ?? {}) as Origen;
  const z = o.zonas_envio ?? {};

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="font-titulo text-2xl text-durazno">Alta / Configuración del agente</h1>
        <p className="text-sm text-cacao">
          Llena los datos del cliente y activa la tienda. Esto se guarda en la base
          de datos — <strong>no hace falta tocar código</strong>.
        </p>
      </div>

      {esSuper && (
        <div>
          <label className={L}>Tienda</label>
          <SelectorTienda tiendas={tiendas} actual={tiendaId} />
        </div>
      )}

      {!tiendaId ? (
        <p className="rounded-xl bg-miel/30 p-4 text-sm text-[#7a5a14]">
          Elige una tienda para configurar su agente.
        </p>
      ) : (
        <form action={guardarConfigAgente} className="space-y-6">
          {esSuper && <input type="hidden" name="tienda_id" value={tiendaId} />}
          {tiendaNombre && (
            <p className="text-sm text-cacao">Configurando: <strong className="text-texto">{tiendaNombre}</strong></p>
          )}

          {/* Datos del cliente */}
          <section className="space-y-3 rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
            <h2 className="font-mano text-lg text-cacao">Datos del cliente</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className={L}>Nombre de la marca *</label>
                <input name="nombre" required defaultValue={m.nombre ?? ""} className={I} placeholder="Ej. Mamielina" />
              </div>
              <div>
                <label className={L}>Nombre de la asesora</label>
                <input name="asesora" defaultValue={m.asesora && m.asesora !== "PENDIENTE" ? m.asesora : ""} className={I} placeholder="Ej. Linda (opcional)" />
              </div>
            </div>
            <div>
              <label className={L}>Voz / tono</label>
              <textarea name="voz" rows={3} defaultValue={m.voz ?? ""} className={I}
                placeholder="Cálida, cercana y maternal. Le habla a mamás que buscan ropa linda para sus hijos…" />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className={L}>Presentación (saludo)</label>
                <input name="presentacion" defaultValue={m.presentacion ?? ""} className={I} placeholder="¡Hola! Soy Linda, de…" />
              </div>
              <div>
                <label className={L}>Máx. emojis por mensaje</label>
                <input name="emoji_max" type="number" min={0} max={5} defaultValue={m.emoji_max ?? 2} className={I} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className={L}>Ciudad de origen</label>
                <input name="ciudad" defaultValue={o.ciudad ?? ""} className={I} placeholder="Ciudad Juárez, Chihuahua" />
              </div>
              <div>
                <label className={L}>Tallas</label>
                <input name="tallas" defaultValue={cfg?.tallas ?? ""} className={I} placeholder="Por edad: 0-24m, 2-3, 4-5…" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className={L}>Envío zona norte</label>
                <input name="zona_norte" defaultValue={z.norte ?? ""} className={I} placeholder="2-3 días" />
              </div>
              <div>
                <label className={L}>Envío zona centro</label>
                <input name="zona_centro" defaultValue={z.centro ?? ""} className={I} placeholder="3-6 días" />
              </div>
              <div>
                <label className={L}>Envío zona sur</label>
                <input name="zona_sur" defaultValue={z.sur ?? ""} className={I} placeholder="4-7 días" />
              </div>
            </div>
            <div>
              <label className={L}>Guardarraíles propios (uno por línea)</label>
              <textarea name="guardarrailes" rows={3} defaultValue={(cfg?.guardarrailes_extra ?? []).join("\n")} className={I}
                placeholder="Ej. No mencionar marcas registradas del torneo…" />
            </div>
          </section>

          {/* Conexiones */}
          <section className="space-y-3 rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
            <h2 className="font-mano text-lg text-cacao">Conexiones</h2>
            <div>
              <label className={L}>WhatsApp — Phone Number ID</label>
              <input name="wa_phone_number_id" defaultValue={waPnid} className={I} placeholder="Ej. 1156067710928309" />
              <p className="mt-1 text-xs text-cacao">El identificador del número (no el teléfono). Lo sacas de Meta → WhatsApp → Configuración de la API.</p>
            </div>
            <div className="rounded-xl bg-crema/60 p-3 text-sm">
              <span className="font-semibold text-texto">Mercado Pago:</span>{" "}
              {secretos?.mp_conectado ? (
                <span className="text-[#3f5a1c]">conectado ✓</span>
              ) : (
                <span className="text-cacao">sin conectar — el botón “Conectar Mercado Pago” se habilita en cuanto registremos la app Marketplace.</span>
              )}
            </div>
          </section>

          {/* Activar */}
          <label className="flex items-center gap-2 text-sm font-semibold text-texto">
            <input type="checkbox" name="activa" defaultChecked={!!cfg?.activa} className="h-4 w-4" />
            Activar tienda (el agente empieza a atender)
          </label>

          <div className="flex items-center gap-3">
            <button className="rounded-full bg-durazno px-6 py-2 text-sm font-bold text-white">Guardar</button>
            <Link href="/admin/agente" className="text-sm font-semibold text-durazno underline">Ver métricas →</Link>
          </div>
        </form>
      )}
    </div>
  );
}
