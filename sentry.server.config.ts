// Sentry — runtime Node.js (server components, route handlers, server actions,
// webhooks del agente). Se carga desde instrumentation.ts. Sin DSN no hace
// nada (init con dsn vacío es no-op), así que en local/preview queda mudo
// mientras no se defina NEXT_PUBLIC_SENTRY_DSN.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Solo errores por ahora (sin performance tracing) para no gastar cuota.
  tracesSampleRate: 0,
  environment: process.env.VERCEL_ENV ?? "development",
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
