"use client";

// Captura en Sentry los errores de render de React que no atrapa ningún
// error boundary más cercano (App Router). Reemplaza al root layout cuando
// ocurre, así que trae su propio <html>/<body>. Sin DSN, Sentry es no-op.
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          fontFamily: "system-ui, sans-serif",
          color: "#4a3f35",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>Algo salió mal</h1>
        <p style={{ margin: 0, color: "#8a7d6f" }}>
          Ya nos enteramos y lo estamos revisando. Intenta recargar la página.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: "0.5rem",
            padding: "0.6rem 1.2rem",
            borderRadius: "999px",
            border: "none",
            background: "#e7a6b8",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Recargar
        </button>
      </body>
    </html>
  );
}
