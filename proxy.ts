import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Proxy de Next 16 (antes "middleware").
 * - En el dominio del PRODUCTO/operador (agentes.*), la portada ES el panel:
 *   la raíz "/" redirige a /admin (gestión del SaaS y alta de tenants).
 *   Los catálogos de cada cliente siguen en su ruta (/<tienda>) o su dominio.
 * - Refresca la sesión de Supabase y protege /admin (lib/supabase/middleware.ts).
 */
export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const esDominioProducto = host.startsWith("agentes.");

  if (esDominioProducto && request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return updateSession(request);
}

export const config = {
  // Corre en todo menos estáticos e imágenes.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
