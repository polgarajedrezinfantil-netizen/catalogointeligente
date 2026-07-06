// Instrumentación de servidor (Next 16). Carga la config de Sentry del runtime
// que toque y reporta los errores de servidor que Next captura (render de
// server components, route handlers, server actions, webhooks).
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  } else if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
