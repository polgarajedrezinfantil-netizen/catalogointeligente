"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useState } from "react";
import Script from "next/script";
import { trackPurchase } from "@/components/MetaPixel";

declare global {
  interface Window {
    MercadoPago?: any;
  }
}

type Props = {
  publicKey: string;
  amount: number;
  pedidoId: string;
  contentIds?: string[];
  moneda?: string;
};

// Formulario de pago de Mercado Pago EMBEBIDO (Payment Brick). Tokeniza la
// tarjeta del lado cliente y manda el resultado a /api/agente/pago/procesar,
// que crea el pago real con el token de la tienda.
export function BrickPago({ publicKey, amount, pedidoId, contentIds = [], moneda = "MXN" }: Props) {
  const [estado, setEstado] = useState<"cargando" | "listo" | "ok" | "revision">("cargando");
  const [aviso, setAviso] = useState<string | null>(null);
  const montado = useRef(false);

  function iniciar() {
    if (montado.current || !window.MercadoPago) return;
    montado.current = true;

    const mp = new window.MercadoPago(publicKey, { locale: "es-MX" });
    mp.bricks().create("payment", "brickPago", {
      initialization: { amount },
      customization: {
        visual: { style: { theme: "default" } },
        paymentMethods: { creditCard: "all", debitCard: "all" },
      },
      callbacks: {
        onReady: () => setEstado("listo"),
        onError: (error: any) => {
          console.error("[brick]", error);
          setAviso("No se pudo cargar el formulario de pago. Recarga la página.");
        },
        onSubmit: ({ formData }: { formData: any }) =>
          new Promise<void>((resolve, reject) => {
            setAviso(null);
            fetch("/api/agente/pago/procesar", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pedidoId, formData }),
            })
              .then((r) => r.json())
              .then((d) => {
                if (d.status === "approved") {
                  // Píxel de Meta: pago aprobado = Purchase. eventID = pedido
                  // para deduplicar si luego se activa Conversions API.
                  trackPurchase({ ids: contentIds, valor: amount, moneda, pedidoId });
                  setEstado("ok");
                  resolve();
                } else if (d.status === "in_process" || d.status === "pending") {
                  setEstado("revision");
                  resolve();
                } else if (d.status === "rejected") {
                  setAviso("El pago fue rechazado. Revisa los datos o intenta con otra tarjeta.");
                  reject();
                } else {
                  setAviso("No se pudo procesar el pago. Intenta de nuevo.");
                  reject();
                }
              })
              .catch(() => {
                setAviso("Hubo un problema de conexión. Intenta de nuevo.");
                reject();
              });
          }),
      },
    });
  }

  if (estado === "ok") {
    return (
      <div className="rounded-2xl border border-verde-mielina/40 bg-verde-mielina/10 p-6 text-center">
        <p className="text-4xl">✅</p>
        <h2 className="mt-2 font-titulo text-xl text-texto">¡Pago recibido!</h2>
        <p className="mt-1 text-sm text-cacao">
          Tu pedido quedó confirmado. En un momento te contactamos para el envío. ¡Gracias! 🧡
        </p>
      </div>
    );
  }

  if (estado === "revision") {
    return (
      <div className="rounded-2xl border border-miel-borde bg-miel/20 p-6 text-center">
        <p className="text-4xl">⏳</p>
        <h2 className="mt-2 font-titulo text-xl text-texto">Pago en revisión</h2>
        <p className="mt-1 text-sm text-cacao">
          Tu pago se está confirmando. Te avisamos en cuanto se acredite.
        </p>
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        strategy="afterInteractive"
        onLoad={iniciar}
      />
      {estado === "cargando" && (
        <p className="py-6 text-center text-sm text-cacao">Cargando el pago seguro…</p>
      )}
      <div id="brickPago" />
      {aviso && (
        <p className="mt-3 rounded-xl bg-durazno/20 p-3 text-center text-sm font-semibold text-[#7a3a26]">
          {aviso}
        </p>
      )}
    </>
  );
}
