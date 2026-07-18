"use client";
/**
 * Píxel de Meta por tienda. Carga fbq con el pixel_id de la tienda y dispara
 * PageView. Los eventos de producto se disparan con los helpers de abajo,
 * SIEMPRE con content_ids = id del producto (el mismo del feed) para que Meta
 * empareje lo que la persona vio con el producto del catálogo (retargeting).
 */
import { useEffect } from "react";
import Script from "next/script";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

/** Dispara un evento estándar de Meta (no-op si no hay píxel cargado). */
export function metaTrack(evento: string, datos?: Record<string, unknown>) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", evento, datos || {});
  }
}

/** ViewContent de un producto (para la página /p/[id]). */
export function trackViewContent(p: { id: string; nombre?: string; precio?: number; moneda?: string }) {
  metaTrack("ViewContent", {
    content_ids: [p.id],
    content_type: "product",
    content_name: p.nombre,
    value: p.precio,
    currency: (p.moneda || "MXN").toUpperCase(),
  });
}

/** AddToCart (al apartar/agregar un producto al carrito). */
export function trackAddToCart(p: { id: string; nombre?: string; precio?: number; moneda?: string }) {
  metaTrack("AddToCart", {
    content_ids: [p.id],
    content_type: "product",
    content_name: p.nombre,
    value: p.precio,
    currency: (p.moneda || "MXN").toUpperCase(),
  });
}

type VC = { id: string; nombre?: string; precio?: number; moneda?: string };

/** Inserta el píxel base + PageView. Ponlo una vez por página (catálogo/producto).
 * `viewContent`: si viene (página de producto), dispara también ViewContent. */
export default function MetaPixel({ pixelId, viewContent }:
  { pixelId: string | null | undefined; viewContent?: VC }) {
  useEffect(() => {
    if (!pixelId || typeof window === "undefined") return;
    // El píxel se carga async; reintenta un momento hasta que fbq exista.
    let n = 0;
    const t = setInterval(() => {
      if (typeof window.fbq === "function") {
        clearInterval(t);
        if (viewContent) trackViewContent(viewContent);
      } else if (++n > 40) {
        clearInterval(t);
      }
    }, 100);
    return () => clearInterval(t);
  }, [pixelId, viewContent?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pixelId) return null;
  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${pixelId}');fbq('track','PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img height="1" width="1" style={{ display: "none" }} alt=""
             src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`} />
      </noscript>
    </>
  );
}
