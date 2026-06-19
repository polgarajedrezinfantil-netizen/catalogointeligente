import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Proxy de Next 16 (antes "middleware"). Refresca la sesión de Supabase
 * y protege las rutas /admin. La lógica vive en lib/supabase/middleware.ts.
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
