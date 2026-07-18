import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// La conversación ahora vive dentro de la bandeja de dos columnas
// (/admin/conversaciones?c=<id>). Redirigimos los enlaces/marcadores antiguos.
export default async function ConversacionRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/conversaciones?c=${id}`);
}
