import type { Metadata } from "next";
import { Fredoka, Baloo_2, Nunito, Caveat } from "next/font/google";
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

export const metadata: Metadata = {
  metadataBase: new URL("https://mamielina.myelplay.com"),
  title: "Catálogo Mamielina — miel y protección",
  description:
    "Catálogo en línea de Mamielina 🍯 Ropa y más para bebés 0-24 meses. Mira y aparta lo que te guste.",
  openGraph: {
    type: "website",
    siteName: "Catálogo Mamielina",
    title: "Catálogo Mamielina — miel y protección",
    description:
      "Ropa y más para bebés 0-24 meses 🍯 Mira el catálogo y aparta lo que te guste.",
    url: "https://mamielina.myelplay.com",
    locale: "es_MX",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "Mamielina — miel y protección",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Catálogo Mamielina — miel y protección",
    description:
      "Ropa y más para bebés 0-24 meses 🍯 Mira el catálogo y aparta lo que te guste.",
    images: ["/og.jpg"],
  },
};

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
