// Iconos-logotipo de cada canal para reconocer de un vistazo de qué chat se
// trata (WhatsApp, Messenger, Instagram, Simulación). SVG de marca inline: sin
// dependencias, funcionan en server components y se ven nítidos en cualquier
// tamaño. Se usan en la bandeja y en el detalle de la conversación.

export const CANAL_NOMBRE: Record<string, string> = {
  simulacion: "Simulación",
  whatsapp: "WhatsApp",
  messenger: "Messenger",
  instagram: "Instagram",
};

// Glifo del teléfono-en-globo de WhatsApp (viewBox 24).
const WHATSAPP =
  "M19.05 4.91A9.82 9.82 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.004c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01zM12.04 20.15h-.003a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.24 8.24 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.23-8.24 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.79.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43-.14-.01-.31-.01-.48-.01-.16 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.16 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29z";

// Rayo blanco del logo de Messenger (viewBox 512).
const MESSENGER =
  "M405.79 193.13l-73 115.57a37.37 37.37 0 0 1-53.91 9.93l-58.08-43.47a15 15 0 0 0-18 0l-78.37 59.44c-10.46 7.93-24.16-4.6-17.11-15.67l73-115.57a37.36 37.36 0 0 1 53.91-9.93l58.06 43.46a15 15 0 0 0 18 0l78.41-59.42c10.44-7.94 24.14 4.6 17.09 15.66z";

// Cámara de Instagram (viewBox 448 512).
const INSTAGRAM =
  "M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z";

/**
 * Avatar circular con el logotipo del canal. `size` en px (default 34).
 * Para 'simulacion' y canales desconocidos usa un chip neutro con emoji.
 */
export function CanalIcono({
  canal,
  size = 34,
}: {
  canal: string | null;
  size?: number;
}) {
  const box = { width: size, height: size } as const;
  const nombre = CANAL_NOMBRE[canal ?? ""] ?? "Chat";

  if (canal === "whatsapp") {
    return (
      <span
        title="WhatsApp"
        aria-label="Canal WhatsApp"
        className="inline-flex shrink-0 items-center justify-center rounded-full shadow-sm ring-1 ring-black/5"
        style={{ ...box, background: "#25D366" }}
      >
        <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="#fff" aria-hidden="true">
          <path d={WHATSAPP} />
        </svg>
      </span>
    );
  }

  if (canal === "messenger") {
    return (
      <span
        title="Messenger"
        aria-label="Canal Messenger"
        className="inline-flex shrink-0 items-center justify-center rounded-full shadow-sm ring-1 ring-black/5"
        style={{
          ...box,
          background: "linear-gradient(45deg,#0099FF 5%,#A033FF 55%,#FF5280 85%,#FF7061 100%)",
        }}
      >
        <svg viewBox="0 0 512 512" width={size * 0.6} height={size * 0.6} fill="#fff" aria-hidden="true">
          <path d={MESSENGER} />
        </svg>
      </span>
    );
  }

  if (canal === "instagram") {
    return (
      <span
        title="Instagram"
        aria-label="Canal Instagram"
        className="inline-flex shrink-0 items-center justify-center rounded-full shadow-sm ring-1 ring-black/5"
        style={{
          ...box,
          background: "linear-gradient(45deg,#FEDA75 5%,#FA7E1E 30%,#D62976 60%,#962FBF 80%,#4F5BD5 100%)",
        }}
      >
        <svg viewBox="0 0 448 512" width={size * 0.56} height={size * 0.56} fill="#fff" aria-hidden="true">
          <path d={INSTAGRAM} />
        </svg>
      </span>
    );
  }

  // Simulación / desconocido: chip neutro (no es un canal de marca).
  return (
    <span
      title={nombre}
      aria-label={`Canal ${nombre}`}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-cacao/15 ring-1 ring-black/5"
      style={{ ...box, fontSize: size * 0.5, lineHeight: 1 }}
    >
      {canal === "simulacion" ? "🧪" : "💬"}
    </span>
  );
}
