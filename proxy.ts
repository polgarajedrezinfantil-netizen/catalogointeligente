import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Proxy de Next 16 (antes "middleware").
 * - La portada "/" se resuelve por host en app/page.tsx: en agentes.* muestra
 *   la landing del producto; en <tienda>.* redirige al catálogo de la tienda.
 * - Refresca la sesión de Supabase y protege /admin (lib/supabase/middleware.ts).
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Corre en todo menos estáticos e imágenes.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
