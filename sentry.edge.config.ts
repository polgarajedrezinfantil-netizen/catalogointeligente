// Sentry — runtime Edge (el middleware/proxy corre aquí). Se carga desde
// instrumentation.ts. Sin DSN es no-op.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  environment: process.env.VERCEL_ENV ?? "development",
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
