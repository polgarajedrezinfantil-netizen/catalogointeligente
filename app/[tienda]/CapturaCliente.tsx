"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Carita } from "@/components/marca/Elementos";

// Clave en el dispositivo para recordar al cliente por tienda.
function claveCliente(tiendaId: string) {
  return `cliente_${tiendaId}`;
}

export function datosClienteLocal(tiendaId: string): {
  celular: string;
  nombre: string;
} | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(claveCliente(tiendaId));
  return raw ? JSON.parse(raw) : null;
}

// Modal que pide nombre + correo + número la primera vez. Lo guarda en el
// dispositivo y en la base (RPC anónima registrar_cliente).
export function CapturaCliente({ tiendaId }: { tiendaId: string }) {
  const supabase = createClient();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [celular, setCelular] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Entrada suave: NO se abre al entrar. Se abre solo cuando el cliente
  // intenta una acción que necesita sus datos (apartar / pedir). Si ya tiene
  // datos, deja continuar la acción pendiente de inmediato.
  useEffect(() => {
    const abrir = () => {
      if (datosClienteLocal(tiendaId)) {
        window.dispatchEvent(new CustomEvent("datos-listos"));
      } else {
        setAbierto(true);
      }
    };
    window.addEventListener("pedir-datos", abrir);
    return () => window.removeEventListener("pedir-datos", abrir);
  }, [tiendaId]);

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    // Guarda en el dispositivo y cierra al instante; el registro en la base
    // va en segundo plano (no bloquea aunque la red del celular sea lenta).
    localStorage.setItem(
      claveCliente(tiendaId),
      JSON.stringify({ celular, nombre }),
    );
    // Avisa al catálogo que ya hay cliente y que puede seguir la acción pendiente.
    window.dispatchEvent(new CustomEvent("cliente-actualizado"));
    window.dispatchEvent(new CustomEvent("datos-listos"));
    supabase
      .rpc("registrar_cliente", {
        p_tienda: tiendaId,
        p_celular: celular,
        p_nombre: nombre,
        p_correo: correo,
      })
      .then(() => {});
    setAbierto(false);
  }

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-crema p-4">
      <form
        onSubmit={guardar}
        className="w-full max-w-sm space-y-4 rounded-[var(--radius-marca)] border border-miel-borde bg-white p-6 shadow-lg"
      >
        <div className="flex flex-col items-center gap-1 text-center">
          <Carita className="h-14 w-14" />
          <h2 className="font-titulo text-xl text-durazno">¡Hola! 🍯</h2>
          <p className="text-sm text-cacao">
            Déjanos tus datos para guardarte un lugarcito y avisarte de novedades.
          </p>
        </div>
        <input
          required
          placeholder="Tu nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="w-full rounded-xl border border-miel-borde bg-crema px-3 py-2"
        />
        <input
          required
          type="email"
          placeholder="Tu correo"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          className="w-full rounded-xl border border-miel-borde bg-crema px-3 py-2"
        />
        <input
          required
          type="tel"
          placeholder="Tu celular (WhatsApp)"
          value={celular}
          onChange={(e) => setCelular(e.target.value)}
          className="w-full rounded-xl border border-miel-borde bg-crema px-3 py-2"
        />
        <button
          disabled={guardando}
          className="w-full rounded-full bg-verde-mielina py-2.5 font-producto font-bold text-white disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Entrar al catálogo"}
        </button>
      </form>
    </div>
  );
}
