import Link from "next/link";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { estadoMP, marketplaceConfigurado } from "@/lib/agente/mp-oauth";
import { guardarConfigAgente, desconectarMP } from "./actions";
import { SelectorTienda } from "./SelectorTienda";

const MP_MSG: Record<string, { txt: string; ok: boolean }> = {
  ok: { txt: "Mercado Pago conectado ✓", ok: true },
  error: { txt: "No se pudo conectar Mercado Pago. Intenta de nuevo.", ok: false },
  estado_invalido: { txt: "El enlace de conexión expiró. Vuelve a intentar.", ok: false },
  sin_code: { txt: "Mercado Pago no devolvió la autorización.", ok: false },
  sin_app: { txt: "Falta configurar la app de Marketplace (MP_CLIENT_ID/SECRET).", ok: false },
  denegado: { txt: "No autorizado para conectar esta tienda.", ok: false },
};

export const dynamic = "force-dynamic";

const I = "w-full rounded-xl border border-miel-borde bg-white px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-durazno/40";
const L = "mb-1 block text-xs font-semibold uppercase tracking-wide text-cacao";

type Marca = { nombre?: string; asesora?: string; voz?: string; emoji_max?: number; presentacion?: string };
type Origen = { ciudad?: string; zonas_envio?: Record<string, string> };

export default async function AltaAgentePage({
  searchParams,
}: {
  searchParams: Promise<{ tienda?: string; mp?: string }>;
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
  let igId = "";
  let fbPageId = "";
  let tiendaNombre = "";
  let mp = { conectado: false, mp_user_id: null as string | null, comision_pct: 0 };
  if (tiendaId) {
    const [{ data: c }, { data: canales }, { data: t }, estado] = await Promise.all([
      supabase.from("agente_config").select("activa, marca, guardarrailes_extra, origen, tallas").eq("tienda_id", tiendaId).maybeSingle(),
      supabase.from("agente_canales").select("tipo, external_id").eq("tienda_id", tiendaId),
      supabase.from("tiendas").select("nombre, slug").eq("id", tiendaId).maybeSingle(),
      estadoMP(tiendaId),
    ]);
    cfg = c;
    const canalMap = new Map((canales ?? []).map((k) => [k.tipo as string, k.external_id as string]));
    waPnid = canalMap.get("whatsapp") ?? "";
    igId = canalMap.get("instagram") ?? "";
    fbPageId = canalMap.get("messenger") ?? "";
    tiendaNombre = (t?.nombre as string) ?? "";
    mp = estado;
  }
  const mpBanner = sp.mp ? MP_MSG[sp.mp] : null;

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

      {mpBanner && (
        <p className={`rounded-xl p-3 text-sm font-semibold ${mpBanner.ok ? "bg-verde-mielina/20 text-[#3f5a1c]" : "bg-durazno/20 text-[#7a3a26]"}`}>
          {mpBanner.txt}
        </p>
      )}

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
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className={L}>Instagram — ID de la cuenta</label>
                <input name="ig_id" defaultValue={igId} className={I} placeholder="Ej. 17841400000000000" />
                <p className="mt-1 text-xs text-cacao">ID de la cuenta de Instagram profesional conectada a tu app de Meta.</p>
              </div>
              <div>
                <label className={L}>Messenger — ID de la página de Facebook</label>
                <input name="fb_page_id" defaultValue={fbPageId} className={I} placeholder="Ej. 102900000000000" />
                <p className="mt-1 text-xs text-cacao">ID de la página de Facebook del cliente (Messenger).</p>
              </div>
            </div>
            <p className="text-xs text-cacao">
              Instagram y Messenger usan tu app de Meta (webhook{" "}
              <code className="rounded bg-crema px-1">/api/agente/meta/webhook</code>) y el envío
              requiere <code className="rounded bg-crema px-1">META_PAGE_TOKEN</code>. TikTok no
              ofrece API pública de mensajería para auto-responder DMs, por eso no aparece.
            </p>
            <div className="space-y-2 rounded-xl bg-crema/60 p-3 text-sm">
              <p>
                <span className="font-semibold text-texto">Mercado Pago:</span>{" "}
                {mp.conectado ? (
                  <span className="text-[#3f5a1c]">conectado ✓{mp.mp_user_id ? ` (cuenta ${mp.mp_user_id})` : ""}</span>
                ) : (
                  <span className="text-cacao">sin conectar</span>
                )}
              </p>
              {mp.conectado ? (
                <button
                  formAction={desconectarMP}
                  className="rounded-full border border-cacao/40 px-4 py-1.5 text-xs font-bold text-cacao"
                >
                  Desconectar
                </button>
              ) : marketplaceConfigurado() ? (
                <a
                  href={`/api/agente/mp/oauth/iniciar?tienda=${tiendaId}`}
                  className="inline-block rounded-full bg-[#009ee3] px-4 py-1.5 text-xs font-bold text-white"
                >
                  Conectar Mercado Pago
                </a>
              ) : (
                <p className="text-xs text-cacao">
                  El botón “Conectar” se habilita cuando registres tu app de Marketplace
                  (variables MP_CLIENT_ID / MP_CLIENT_SECRET).
                </p>
              )}
              {esSuper && (
                <div className="pt-1">
                  <label className={L}>Tu comisión por venta (%)</label>
                  <input
                    name="comision_pct"
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    defaultValue={mp.comision_pct}
                    className="w-28 rounded-xl border border-miel-borde bg-white px-3 py-1.5 text-sm text-texto"
                  />
                </div>
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
