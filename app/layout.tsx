import type { Metadata } from "next";
import { headers } from "next/headers";
import { Fredoka, Baloo_2, Nunito, Caveat } from "next/font/google";
import { tiendaPorHost } from "@/lib/marca-host";
import { urlFoto } from "@/lib/fotos";
import "./globals.css";

// Tipografías del brand board, cargadas y optimizadas por next/font.
// Cada una expone una CSS var que globals.css mapea a un token de Tailwind.
const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});
const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["600", "700"],
});
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});
const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["600", "700"],
});

// Metadata por host: en <tienda>.myelplay.com la marca es la de esa tienda;
// en el dominio del producto (agentes.*) y hosts técnicos, "MyelPlay Agentes".
// Las páginas de catálogo ([tienda]) siguen afinando su propio OG por BD.
export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = (h.get("host") ?? "").split(":")[0];
  const proto = host.startsWith("localhost") ? "http" : "https";
  const base = new URL(host ? `${proto}://${host}` : "http://localhost:3000");

  const tienda = await tiendaPorHost();
  if (tienda) {
    const titulo = `Catálogo ${tienda.nombre}`;
    const desc = `Catálogo en línea de ${tienda.nombre}. Mira y aparta lo que te guste.`;
    // El og.jpg del repo es el arte de Mamielina; las demás tiendas usan su logo.
    const img =
      tienda.slug === "mamielina"
        ? "/og.jpg"
        : tienda.logo_url
          ? urlFoto(tienda.logo_url)
          : undefined;
    return {
      metadataBase: base,
      title: titulo,
      description: desc,
      openGraph: {
        type: "website",
        siteName: titulo,
        title: tienda.nombre,
        description: desc,
        url: base.toString(),
        locale: "es_MX",
        ...(img ? { images: [{ url: img, width: 1200, height: 630, alt: tienda.nombre }] } : {}),
      },
      twitter: {
        card: "summary_large_image",
        title: tienda.nombre,
        description: desc,
        ...(img ? { images: [img] } : {}),
      },
    };
  }

  const desc =
    "Catálogo en línea con tu marca, apartados en vivo y pedidos por WhatsApp — con agente de ventas IA opcional.";
  return {
    metadataBase: base,
    title: "MyelPlay Agentes",
    description: desc,
    openGraph: {
      type: "website",
      siteName: "MyelPlay Agentes",
      title: "MyelPlay Agentes",
      description: desc,
      url: base.toString(),
      locale: "es_MX",
    },
    twitter: { card: "summary", title: "MyelPlay Agentes", description: desc },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${fredoka.variable} ${baloo.variable} ${nunito.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-crema text-texto">
        {children}
      </body>
    </html>
  );
}
