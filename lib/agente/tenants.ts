// Config de agente por tienda (marca, voz, guardarraíles, origen/envío).
// Espejo de agenteiaventas/tenants/<slug>/config.json. Mantener en sync.
// (En una fase futura esto puede leerse desde la BD o desde el repo del producto.)

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

export const TENANTS: Record<string, ConfigTenant> = {
  "hola-mexico": {
    tenant_id: "hola-mexico",
    activa: true,
    marca: {
      nombre: "Hola Mexico",
      asesora: "Linda",
      voz: "Cálida, cercana y mexicana, festiva con el orgullo nacional sin caer en lo cursi ni gritón. Vende el sentimiento de ser mexicano con prendas 100% propias.",
      emoji_max: 2,
      presentacion: "¡Hola! Soy Linda, de Hola Mexico 🇲🇽",
    },
    guardarrailes_extra: [
      "NUNCA mencionar marcas/eventos protegidos del torneo (FIFA, Mundial, World Cup, Copa del Mundo, emblema/mascota/trofeo oficiales ni la playera oficial). Hablar de 'la fiesta del fútbol', 'vibra de la Selección', 'orgullo mexicano', 'día de partido'. Protege la cuenta de un baneo: es innegociable.",
    ],
    origen: {
      ciudad: "Ciudad Juárez, Chihuahua",
      zonas_envio: { norte: "2-3 días", centro: "3-6 días", sur: "4-7 días" },
    },
    tallas: "estándar",
  },

  mamielina: {
    tenant_id: "mamielina",
    activa: true,
    marca: {
      nombre: "Mamielina",
      asesora: "PENDIENTE",
      voz: "Cálida, cercana y maternal. Le habla a mamás y papás que buscan ropa linda, cómoda y de calidad para sus hijos. Tierna sin empalagar, práctica y de confianza.",
      emoji_max: 2,
    },
    origen: {
      ciudad: "Ciudad Juárez, Chihuahua",
    },
    tallas:
      "Por edad: 0-24 meses, 2-3, 4-5, 6-7, 8-10 años, adolescentes; además línea 'Mami'.",
  },
};

export function configTenant(slug: string): ConfigTenant | null {
  return TENANTS[slug] ?? null;
}

/**
 * Carga la config del agente de una tienda DESDE LA BASE DE DATOS (tabla
 * agente_config). Si la tienda aún no fue dada de alta en BD, cae al mapa
 * hardcodeado TENANTS (respaldo transitorio mientras se migran las tiendas).
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
  return TENANTS[slug] ?? null;
}
