// Helpers para las fotos guardadas en el bucket público 'fotos'.

const BUCKET = "fotos";

/** URL pública de una foto a partir de su path en Storage. */
export function urlFoto(path: string | null | undefined): string {
  if (!path) return "";
  // Si ya es una URL completa (seed con URLs externas), úsala tal cual.
  if (path.startsWith("http")) return path;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

export { BUCKET };
