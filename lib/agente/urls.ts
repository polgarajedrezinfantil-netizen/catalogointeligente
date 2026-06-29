// Base pública del sitio (back_urls, notification_url, redirect de OAuth).
export function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "https://mamielina.myelplay.com"
  ).replace(/\/$/, "");
}
