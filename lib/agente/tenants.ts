// Config de agente por tienda (marca, voz, guardarraíles, origen/envío).
// FUENTE DE VERDAD: la tabla `agente_config` en la base de datos (se edita
// desde el panel en /admin/agente/alta). Aquí solo vive el tipo y el loader.

export type ConfigTenant = {
  tenant_id: string;
  activa: boolean;
  marca: {
    nombre: string;
    asesora: string;
    voz: string;
    emoji_max: number;
    presentacion?: string;
  };
  guardarrailes_extra?: string[];
  origen?: {
    ciudad: string;
    zonas_envio?: Record<string, string>;
  };
  tallas?: string;
};

/**
 * Carga la config del agente de una tienda DESDE LA BASE DE DATOS (tabla
 * agente_config, que se edita en /admin/agente/alta). Devuelve null si la
 * tienda todavía no completó el alta del agente (el orquestador lo maneja y
 * el agente no responde hasta que exista config válida y activa).
 * Usa la SERVICE ROLE (runtime sin sesión).
 */
export async function cargarConfigTenant(
  tiendaId: string,
  slug: string,
): Promise<ConfigTenant | null> {
  const { createServiceClient } = await import("@/lib/supabase/service");
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("agente_config")
    .select("activa, marca, guardarrailes_extra, origen, tallas")
    .eq("tienda_id", tiendaId)
    .maybeSingle();

  if (data && data.marca && (data.marca as { nombre?: string }).nombre) {
    return {
      tenant_id: slug,
      activa: !!data.activa,
      marca: data.marca as ConfigTenant["marca"],
      guardarrailes_extra: (data.guardarrailes_extra as string[]) ?? [],
      origen: (data.origen as ConfigTenant["origen"]) ?? undefined,
      tallas: (data.tallas as string | null) ?? undefined,
    };
  }
  return null;
}
