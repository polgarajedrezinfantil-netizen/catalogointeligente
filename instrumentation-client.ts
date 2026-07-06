// Instrumentación de cliente (Next 16): inicializa Sentry en el navegador
// antes de la hidratación. Sin DSN es no-op. Captura los errores que sufren
// los usuarios dentro del panel.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});

// Enlaza las transiciones de navegación del App Router con Sentry.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
