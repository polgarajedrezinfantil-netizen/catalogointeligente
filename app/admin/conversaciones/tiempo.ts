// Helpers de tiempo para la bandeja (usados en server y en cliente).

/** Fecha absoluta legible: "18 jul, 01:58 p.m.". Para el title/hover. */
export function fecha(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

/** Tiempo relativo para escanear recencia: "ahora", "hace 5 min", "ayer". */
export function hace(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return "ahora";
  const rtf = new Intl.RelativeTimeFormat("es-MX", { numeric: "auto" });
  const min = Math.round(s / 60);
  if (min < 60) return rtf.format(-min, "minute");
  const h = Math.round(min / 60);
  if (h < 24) return rtf.format(-h, "hour");
  const d = Math.round(h / 24);
  if (d < 30) return rtf.format(-d, "day");
  const mes = Math.round(d / 30);
  if (mes < 12) return rtf.format(-mes, "month");
  return rtf.format(-Math.round(mes / 12), "year");
}
