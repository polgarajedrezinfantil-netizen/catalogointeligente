"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Mantiene la bandeja "viva": re-consulta el server component cada N segundos
// (router.refresh mezcla el nuevo RSC sin perder scroll ni estado). Se pausa si
// la pestaña está en segundo plano y refresca al volver a ella, para no gastar
// consultas de balde.
export function AutoRefrescar({ segundos = 10 }: { segundos?: number }) {
  const router = useRouter();

  useEffect(() => {
    const refrescarSiVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(refrescarSiVisible, segundos * 1000);
    document.addEventListener("visibilitychange", refrescarSiVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refrescarSiVisible);
    };
  }, [router, segundos]);

  return null;
}
