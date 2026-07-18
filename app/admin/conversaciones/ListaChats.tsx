"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CanalIcono } from "./canal";
import { hace, fecha } from "./tiempo";

export type ConvLista = {
  id: string;
  tipo_canal: string | null;
  cliente_externo_id: string;
  cliente_nombre: string | null;
  estado: "abierta" | "en_humano" | "cerrada";
  ultimo_mensaje_en: string;
};

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Columna izquierda: buscador + pestañas (Pendientes/Todas) + lista de chats.
// Los que necesitan humano se pintan y llevan "te toca"; el abierto se resalta.
export function ListaChats({
  convs,
  previews,
  selected,
  tienda,
  arch,
}: {
  convs: ConvLista[];
  previews: Record<string, string>;
  selected: string | null;
  tienda: string | null;
  arch: boolean;
}) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"todas" | "pendientes">("todas");

  const pendientesCount = useMemo(
    () => convs.filter((c) => c.estado === "en_humano").length,
    [convs],
  );

  const lista = useMemo(() => {
    let arr = tab === "pendientes" ? convs.filter((c) => c.estado === "en_humano") : convs;
    const term = norm(q.trim());
    if (term) {
      arr = arr.filter((c) =>
        norm([c.cliente_nombre ?? "", c.cliente_externo_id, previews[c.id] ?? ""].join(" ")).includes(term),
      );
    }
    // Pendientes primero; dentro de cada grupo se conserva el orden por fecha.
    return [...arr].sort((a, b) => {
      const ap = a.estado === "en_humano" ? 0 : 1;
      const bp = b.estado === "en_humano" ? 0 : 1;
      return ap - bp;
    });
  }, [convs, previews, q, tab]);

  const href = (id: string) => {
    const p = new URLSearchParams();
    if (tienda) p.set("tienda", tienda);
    if (arch) p.set("arch", "1");
    p.set("c", id);
    return `/admin/conversaciones?${p.toString()}`;
  };

  const navHref = (verArchivadas: boolean) => {
    const p = new URLSearchParams();
    if (tienda) p.set("tienda", tienda);
    if (verArchivadas) p.set("arch", "1");
    const qs = p.toString();
    return qs ? `/admin/conversaciones?${qs}` : "/admin/conversaciones";
  };

  const tabCls = (activo: boolean) =>
    `flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition ${
      activo ? "bg-durazno text-white" : "bg-crema text-cacao hover:bg-miel/40"
    }`;

  return (
    <div className="flex h-full min-h-0 flex-col rounded-[var(--radius-marca)] border border-miel-borde bg-white">
      {/* Buscador + pestañas */}
      <div className="shrink-0 space-y-2 border-b border-miel-borde p-2.5">
        {arch && (
          <Link href={navHref(false)} className="inline-flex items-center gap-1 text-xs font-semibold text-durazno">
            ← Volver a activas
          </Link>
        )}
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cacao">🔍</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, teléfono o mensaje"
            className="w-full rounded-full border border-miel-borde bg-crema/60 py-2 pl-9 pr-3 text-sm text-texto placeholder:text-cacao/70 focus:outline-none focus:ring-2 focus:ring-durazno/40"
          />
        </div>
        {arch ? (
          <p className="px-1 text-xs font-bold text-cacao">🗄 Archivadas ({convs.length})</p>
        ) : (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setTab("pendientes")} className={tabCls(tab === "pendientes")}>
              🔔 Pendientes
              {pendientesCount > 0 && (
                <span
                  className={`rounded-full px-1.5 text-[10px] ${
                    tab === "pendientes" ? "bg-white/25" : "bg-durazno text-white"
                  }`}
                >
                  {pendientesCount}
                </span>
              )}
            </button>
            <button type="button" onClick={() => setTab("todas")} className={tabCls(tab === "todas")}>
              Todas
              <span className={`rounded-full px-1.5 text-[10px] ${tab === "todas" ? "bg-white/25" : "bg-cacao/20 text-cacao"}`}>
                {convs.length}
              </span>
            </button>
            <Link
              href={navHref(true)}
              className="ml-auto rounded-full px-2 py-1 text-xs font-semibold text-cacao hover:bg-miel/40"
            >
              🗄 Archivadas
            </Link>
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {lista.length === 0 ? (
          <p className="p-6 text-center text-sm text-cacao">
            {q
              ? "Sin resultados para tu búsqueda."
              : arch
                ? "No hay conversaciones archivadas."
                : tab === "pendientes"
                  ? "Sin pendientes 🎉"
                  : "Aún no hay conversaciones."}
          </p>
        ) : (
          lista.map((c) => {
            const activo = selected === c.id;
            const urge = c.estado === "en_humano";
            return (
              <Link
                key={c.id}
                href={href(c.id)}
                className={`mb-1.5 flex items-center gap-2.5 rounded-xl border p-2.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-durazno/50 ${
                  activo
                    ? "border-durazno/50 bg-durazno/10"
                    : urge
                      ? "border-durazno/25 bg-durazno/[0.06] hover:bg-durazno/10"
                      : "border-transparent hover:bg-miel/25"
                }`}
              >
                <CanalIcono canal={c.tipo_canal} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-texto">
                      {c.cliente_nombre || c.cliente_externo_id}
                    </span>
                    {urge && (
                      <span className="shrink-0 rounded-full bg-durazno px-1.5 py-0.5 text-[10px] font-bold text-white">
                        te toca
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-1 text-xs text-cacao">{previews[c.id] ?? "—"}</p>
                </div>
                <span className="shrink-0 self-start text-[10px] text-cacao" title={fecha(c.ultimo_mensaje_en)}>
                  {hace(c.ultimo_mensaje_en)}
                </span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
