"use client";

import { useState } from "react";
import { registrarMensaje } from "./actions";

// Mensajería a un cliente: WhatsApp (wa.me prearmado) + correo opcional.
export function EnviarMensaje({
  celular,
  correo,
  nombre,
}: {
  celular: string;
  correo: string | null;
  nombre: string;
}) {
  const [texto, setTexto] = useState(
    `¡Hola ${nombre}! 🍯 Te escribimos de la tienda…`,
  );
  const [estado, setEstado] = useState<string | null>(null);
  const wa = `https://wa.me/${celular.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;

  async function enviarCorreo() {
    if (!correo) return;
    setEstado("Enviando correo…");
    const r = await fetch("/api/correo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo, celular, asunto: "Mensaje de la tienda", cuerpo: texto }),
    });
    const j = await r.json();
    setEstado(j.ok ? "Correo enviado ✅" : `Correo: ${j.error}`);
  }

  return (
    <div className="mt-2 rounded-xl bg-crema p-2">
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-miel-borde bg-white px-2 py-1 text-sm"
      />
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {/* Abrir WhatsApp y registrar el envío en la bitácora */}
        <form action={registrarMensaje}>
          <input type="hidden" name="celular" value={celular} />
          <input type="hidden" name="canal" value="whatsapp" />
          <input type="hidden" name="cuerpo" value={texto} />
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-full bg-verde-mielina px-3 py-1 text-sm font-bold text-white"
          >
            WhatsApp 💬
          </a>
          <button className="ml-1 rounded-full border border-miel-borde px-2 py-1 text-xs">
            Marcar enviado
          </button>
        </form>
        {correo && (
          <button
            onClick={enviarCorreo}
            className="rounded-full border border-miel-borde px-3 py-1 text-sm font-semibold"
          >
            Enviar correo ✉️
          </button>
        )}
        {estado && <span className="text-xs text-cacao">{estado}</span>}
      </div>
    </div>
  );
}
