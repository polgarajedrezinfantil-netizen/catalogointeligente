import Link from "next/link";
import { LogoMamielina, Carita, Ondas } from "@/components/marca/Elementos";

// Página de bienvenida. Enlaza al catálogo de la tienda demo (mamielina) y
// al panel de administración.
const TIENDA_DEMO = "mamielina";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <Carita className="h-20 w-20" />
      <LogoMamielina className="text-3xl" />
      <p className="font-mano text-2xl text-cacao">miel &amp; protección</p>
      <Ondas className="h-3 w-48 text-verde-mielina" />
      <h1 className="font-titulo text-2xl text-durazno">
        Los Nidos de Mamielina
      </h1>
      <p className="max-w-sm text-cacao">
        Catálogo en línea con apartado en vivo. Cada colección es un Nido.
      </p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/${TIENDA_DEMO}`}
          className="rounded-full bg-verde-mielina px-6 py-3 font-producto font-bold text-white shadow-sm transition hover:brightness-95"
        >
          Ver el catálogo
        </Link>
        <Link
          href="/admin"
          className="rounded-full border border-miel-borde bg-white px-6 py-3 font-producto font-bold text-texto transition hover:bg-miel/30"
        >
          Panel de administración
        </Link>
      </div>
    </main>
  );
}
