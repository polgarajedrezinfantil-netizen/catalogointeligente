import type { Metadata } from "next";
import Link from "next/link";
import { TRIAL_DIAS } from "@/lib/saas/suscripciones";
import { RegistroForm } from "./RegistroForm";

export const metadata: Metadata = {
  title: "Crea tu tienda — MyelPlay Agentes",
  description: `Catálogo en línea con apartados y pedidos por WhatsApp. Prueba gratis ${TRIAL_DIAS} días.`,
  robots: { index: true, follow: true },
};

// Alta self-service (Fase 3): tienda nueva con prueba gratis, sin operador.
export default function RegistroPage() {
  return (
    <main className="admin-shell flex min-h-screen flex-col items-center justify-center gap-8 bg-slate-100 px-6 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-600 text-sm font-black tracking-tight text-white">
            MA
          </span>
          <span className="text-2xl font-bold text-slate-800">MyelPlay Agentes</span>
        </Link>
        <h1 className="max-w-md text-balance text-3xl font-bold text-slate-900">
          Crea tu tienda y empieza a vender hoy
        </h1>
        <p className="max-w-md text-slate-600">
          <strong>{TRIAL_DIAS} días gratis</strong>, sin tarjeta. Después, $299 MXN al mes.
          Catálogo con tu marca, apartados en vivo y pedidos directo a tu WhatsApp.
        </p>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <RegistroForm />
      </div>

      <p className="text-sm text-slate-500">
        ¿Ya tienes cuenta?{" "}
        <Link href="/admin/login" className="font-semibold text-indigo-600 hover:underline">
          Entra al panel
        </Link>
      </p>

      <footer className="flex gap-5 text-xs text-slate-400">
        <Link href="/privacidad" className="hover:text-slate-600">
          Aviso de privacidad
        </Link>
        <Link href="/eliminar-datos" className="hover:text-slate-600">
          Eliminación de datos
        </Link>
      </footer>
    </main>
  );
}
