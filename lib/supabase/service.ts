import { createClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase con SERVICE ROLE. ¡SOLO EN EL SERVIDOR!
 * Salta las políticas RLS: úsalo únicamente en Route Handlers / Server Actions
 * para operaciones privilegiadas (seed, IA, webhooks de pago, RPC sensibles).
 * NUNCA lo importes en código de cliente.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
