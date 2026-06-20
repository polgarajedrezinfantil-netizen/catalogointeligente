import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Destino del enlace de recuperación de contraseña.
// Abre la sesión (a partir del `code` PKCE o del `token_hash` OTP que manda
// Supabase) y redirige a la página para escribir la nueva contraseña.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/admin/nueva-clave`);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "recovery",
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(`${origin}/admin/nueva-clave`);
  }

  // Enlace inválido o vencido: de vuelta al login.
  return NextResponse.redirect(`${origin}/admin/login?error=enlace`);
}
