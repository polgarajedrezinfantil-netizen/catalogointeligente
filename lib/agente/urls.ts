// Base pública del sitio (back_urls, notification_url, redirect de OAuth).
// En producción NEXT_PUBLIC_SITE_URL es OBLIGATORIA (ver .env.example); el
// fallback de VERCEL_URL cubre previews y el de localhost el desarrollo.
export function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}
