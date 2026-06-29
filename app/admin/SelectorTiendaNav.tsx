"use client";

import { useRouter } from "next/navigation";

type Op = { id: string; nombre: string; slug: string };

// Selector de tienda para el superadmin en pantallas de monitoreo (métricas,
// conversaciones). Al cambiar, navega a `base?tienda=<id>` para ver esa tienda.
export function SelectorTiendaNav({
  tiendas,
  actual,
  base,
}: {
  tiendas: Op[];
  actual: string;
  base: string;
}) {
  const router = useRouter();
  return (
    <select
      value={actual}
      onChange={(e) => router.push(e.target.value ? `${base}?tienda=${e.target.value}` : base)}
      className="rounded-xl border border-miel-borde bg-white px-3 py-2 text-sm text-texto"
    >
      <option value="">— Elige una tienda —</option>
      {tiendas.map((t) => (
        <option key={t.id} value={t.id}>
          {t.nombre} ({t.slug})
        </option>
      ))}
    </select>
  );
}
