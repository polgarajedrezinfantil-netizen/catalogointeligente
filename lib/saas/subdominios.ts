// Subdominios de myelplay.com que NUNCA pueden asignarse como slug de una
// tienda: pertenecen a la infraestructura o a otros productos del ecosistema
// (Nicómaco, POLGAR, paraguas corporativo). El registro completo y las reglas
// del namespace viven en INFRAESTRUCTURA.md (fuente de verdad, hallazgo H1
// de la auditoría 2026-07-03).
export const SUBDOMINIOS_RESERVADOS = new Set([
  // Infraestructura / paraguas MyelPlay
  "www",
  "api",
  "mail",
  "smtp",
  "webmail",
  "admin",
  "status",
  "docs",
  "cdn",
  "assets",
  "nexus",
  // Este producto (MyelPlay Agentes)
  "agentes",
  // Nicómaco (SaaS electoral)
  "app",
  "mcjuarez",
  // POLGAR (escuela de ajedrez)
  "polgar",
  "platform",
]);

// Un slug reservado se trata igual que uno ocupado: el alta le agrega sufijo.
export function esSlugReservado(slug: string) {
  return SUBDOMINIOS_RESERVADOS.has(slug);
}
