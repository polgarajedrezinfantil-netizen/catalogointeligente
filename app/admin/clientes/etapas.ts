// Vocabulario del CRM, en un solo sitio: la lista, la bandeja y la ficha
// tienen que llamar a las cosas igual y pintarlas igual.

export type Etapa = "nuevo" | "interesado" | "en_pedido" | "comprador" | "recurrente";

export const ETAPAS: Record<Etapa, { nombre: string; cls: string; ayuda: string }> = {
  nuevo: {
    nombre: "Nuevo",
    cls: "bg-cacao/15 text-cacao",
    ayuda: "Dejó sus datos pero todavía no muestra interés por nada concreto.",
  },
  interesado: {
    nombre: "Interesado",
    cls: "bg-miel text-[#7a5a14]",
    ayuda: "Apartó algo o pidió algo que no tienes. Es el momento de escribirle.",
  },
  en_pedido: {
    nombre: "Por cobrar",
    cls: "bg-durazno/30 text-[#7a3a26]",
    ayuda: "Tiene un pedido sin pagar. Es lo más urgente de tu lista.",
  },
  comprador: {
    nombre: "Compró",
    cls: "bg-verde-mielina/30 text-[#3f5a1c]",
    ayuda: "Ya te compró una vez. El objetivo es que vuelva.",
  },
  recurrente: {
    nombre: "Recurrente",
    cls: "bg-verde-mielina/50 text-[#2f4614]",
    ayuda: "Te ha comprado dos veces o más. Cuídala.",
  },
};

// Los segmentos de la bandeja, en el orden en que conviene trabajarlos.
export const SEGMENTOS = [
  { clave: "seguir_hoy", nombre: "A seguir hoy" },
  { clave: "en_pedido", nombre: "Por cobrar" },
  { clave: "solicitudes", nombre: "Piden algo" },
  { clave: "interesado", nombre: "Interesados" },
  { clave: "recurrente", nombre: "Recurrentes" },
  { clave: "comprador", nombre: "Compraron" },
  { clave: "nuevo", nombre: "Nuevos" },
  { clave: "dormidos", nombre: "Dormidos" },
  { clave: "todos", nombre: "Todos" },
] as const;

export const ORDENES: Record<string, string> = {
  reciente: "Última visita",
  seguimiento: "Seguimiento",
  gastado: "Gastado",
  pedidos: "Pedidos",
  nombre: "Nombre",
};

// Nombres legibles para los tipos de evento que guarda la bitácora.
export const ACTIVIDAD: Record<string, string> = {
  abrir_producto: "Vio",
  ver_nido: "Abrió el nido",
  buscar: "Buscó",
  apartar: "Apartó",
  liberar: "Soltó",
  vencer: "Se le venció el apartado de",
  pasar_siguiente: "Le tocó turno de",
  unir_cola: "Se formó por",
  salir_cola: "Salió de la fila de",
  pedido: "Generó un pedido",
  comprar: "Compró",
  vender: "Compró",
};

export const ICONO_TIEMPO: Record<string, string> = {
  pedido: "🧾",
  solicitud: "🔎",
  mensaje: "💬",
  chat: "🤖",
  evento: "👁️",
};

export function etapaDe(v: string | null | undefined) {
  return ETAPAS[(v ?? "nuevo") as Etapa] ?? ETAPAS.nuevo;
}

export function dia(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" });
}

export function cuando(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

// "hoy", "mañana", "hace 3 días" — para que la fecha de seguimiento se lea
// de un vistazo en vez de obligar a calcular.
//
// `hoyTienda` viene del servidor (el día en la zona horaria de la tienda).
// No se usa la fecha del navegador a propósito: quien mira el panel puede
// estar en otro huso, y entonces vería "mañana" en algo que a la tienda ya
// le tocaba hoy.
export function cuandoToca(
  fecha: string | null,
  hoyTienda: string,
): { txt: string; vencido: boolean } | null {
  if (!fecha) return null;
  const hoy = new Date(hoyTienda + "T00:00:00");
  const f = new Date(fecha + "T00:00:00");
  const dias = Math.round((f.getTime() - hoy.getTime()) / 86400000);
  if (dias === 0) return { txt: "hoy", vencido: true };
  if (dias === 1) return { txt: "mañana", vencido: false };
  if (dias === -1) return { txt: "ayer", vencido: true };
  if (dias < 0) return { txt: `hace ${-dias} días`, vencido: true };
  if (dias < 7) return { txt: `en ${dias} días`, vencido: false };
  return { txt: dia(fecha), vencido: false };
}
