import Link from "next/link";
import { notFound } from "next/navigation";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FichaCliente } from "../FichaCliente";
import type { Ficha } from "../tipos";

export const dynamic = "force-dynamic";

export default async function FichaClientePage({
  params,
}: {
  params: Promise<{ celular: string }>;
}) {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) {
    return <p className="text-cacao">Esta sección es para administradores de una tienda.</p>;
  }
  const t = perfil.tienda_id;
  const { celular: celularParam } = await params;
  const celular = decodeURIComponent(celularParam);

  const supabase = await createClient();
  const [{ data, error }, { data: tienda }] = await Promise.all([
    supabase.rpc("cliente_ficha", { p_tienda: t, p_celular: celular }),
    supabase.from("tiendas").select("etiqueta_precio").eq("id", t).single(),
  ]);

  if (error) {
    return (
      <div className="max-w-3xl space-y-3">
        <Link href="/admin/clientes" className="text-sm text-cacao underline">← Clientes</Link>
        <p className="rounded-xl bg-coral/15 p-3 text-sm text-coral">
          No se pudo cargar la ficha: {error.message}
        </p>
      </div>
    );
  }
  if (!data) notFound();

  return (
    <div className="max-w-5xl space-y-4">
      <Link href="/admin/clientes" className="text-sm text-cacao underline">← Clientes</Link>
      <FichaCliente f={data as Ficha} simbolo={tienda?.etiqueta_precio ?? "$"} />
    </div>
  );
}
