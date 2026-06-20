import { redirect } from "next/navigation";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Plan, Tienda } from "@/lib/tipos";
import { crearTienda, cambiarPlan, alternarActiva } from "./actions";
import { InvitarEquipo } from "./InvitarEquipo";
import { GestionUsuarios } from "./GestionUsuarios";

// Panel de superadmin: alta y gestión de tiendas del SaaS.
export default async function TiendasPage() {
  const perfil = await getPerfil();
  if (perfil?.rol !== "superadmin") redirect("/admin");

  const supabase = await createClient();
  const [{ data: tiendas }, { data: planes }, { data: perfiles }] =
    await Promise.all([
      supabase.from("tiendas").select("*").order("creado", { ascending: false }),
      supabase.from("planes").select("*").order("orden"),
      supabase.from("perfiles").select("id, nombre, rol, tienda_id"),
    ]);

  const listaTiendas = (tiendas ?? []) as Tienda[];
  const listaPlanes = (planes ?? []) as Plan[];

  // Correos (viven en auth.users) para poder mostrarlos junto a cada perfil.
  const admin = createServiceClient();
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailPorId = new Map(
    (authData?.users ?? []).map((u) => [u.id, u.email ?? ""]),
  );

  return (
    <div className="space-y-6">
      <h1 className="font-titulo text-2xl text-durazno">Tiendas</h1>

      {/* Alta de tienda */}
      <form
        action={crearTienda}
        className="grid gap-3 rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4 sm:grid-cols-[1fr_auto_auto_auto]"
      >
        <input
          name="nombre"
          required
          placeholder="Nombre de la tienda"
          className="rounded-xl border border-miel-borde bg-crema px-3 py-2 outline-none focus:border-verde-mielina"
        />
        <select
          name="plan"
          defaultValue="basico"
          className="rounded-xl border border-miel-borde bg-crema px-3 py-2"
        >
          {listaPlanes.map((p) => (
            <option key={p.clave} value={p.clave}>
              {p.nombre}{" "}
              {p.max_catalogos == null ? "(∞)" : `(${p.max_catalogos})`}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-cacao">
          <input type="checkbox" name="sembrar" defaultChecked /> Datos demo
        </label>
        <button className="rounded-full bg-verde-mielina px-5 py-2 font-bold text-white">
          Crear
        </button>
      </form>

      {/* Lista de tiendas */}
      <div className="space-y-4">
        {listaTiendas.length === 0 && (
          <p className="text-cacao">Aún no hay tiendas. Crea la primera arriba.</p>
        )}
        {listaTiendas.map((t) => {
          const usuarios = (perfiles ?? [])
            .filter((p) => p.tienda_id === t.id)
            .map((p) => ({
              id: p.id as string,
              nombre: p.nombre as string,
              rol: p.rol as string,
              email: emailPorId.get(p.id as string) ?? "",
            }));
          const plan = listaPlanes.find((p) => p.clave === t.plan_clave);
          return (
            <div
              key={t.id}
              className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-producto text-lg font-bold text-texto">
                  {t.nombre}
                </span>
                <code className="rounded bg-crema px-2 py-0.5 text-xs text-cacao">
                  /{t.slug}
                </code>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    t.activa
                      ? "bg-verde-mielina/30 text-[#3f5a1c]"
                      : "bg-cacao/20 text-cacao"
                  }`}
                >
                  {t.activa ? "activa" : "inactiva"}
                </span>
                <span className="ml-auto text-xs text-cacao">
                  Catálogos máx:{" "}
                  <strong>
                    {plan?.max_catalogos == null ? "∞" : plan?.max_catalogos}
                  </strong>
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-4">
                {/* Cambiar plan */}
                <form action={cambiarPlan} className="flex items-end gap-2">
                  <input type="hidden" name="tienda_id" value={t.id} />
                  <label className="text-xs text-cacao">
                    Plan
                    <select
                      name="plan"
                      defaultValue={t.plan_clave}
                      className="mt-1 block rounded-lg border border-miel-borde bg-crema px-2 py-1 text-sm"
                    >
                      {listaPlanes.map((p) => (
                        <option key={p.clave} value={p.clave}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="rounded-full border border-miel-borde px-3 py-1 text-sm font-semibold">
                    Guardar
                  </button>
                </form>

                {/* Activar / desactivar */}
                <form action={alternarActiva}>
                  <input type="hidden" name="tienda_id" value={t.id} />
                  <input type="hidden" name="activa" value={String(t.activa)} />
                  <button className="rounded-full border border-miel-borde px-3 py-1 text-sm font-semibold">
                    {t.activa ? "Desactivar" : "Activar"}
                  </button>
                </form>
              </div>

              {/* Invitar usuario (contraseña temporal o correo) */}
              <InvitarEquipo tiendaId={t.id} />

              {/* Equipo: ver correos, restablecer contraseñas y eliminar */}
              <GestionUsuarios usuarios={usuarios} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
