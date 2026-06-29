"use client";

import { useRouter } from "next/navigation";

type Op = { id: string; nombre: string; slug: string };

// Selector de tienda para el superadmin: al cambiar, recarga la página con la
// tienda elegida para precargar (o vaciar) su config.
export function SelectorTienda({ tiendas, actual }: { tiendas: Op[]; actual: string }) {
  const router = useRouter();
  return (
    <select
      value={actual}
      onChange={(e) => router.push(`/admin/agente/alta?tienda=${e.target.value}`)}
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
