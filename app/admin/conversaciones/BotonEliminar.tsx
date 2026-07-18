"use client";

// Botón de borrado definitivo con confirmación. Recibe la server action como
// prop y la usa como action del form; el confirm() evita borrados por descuido.
export function BotonEliminar({
  action,
  id,
  volver,
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  volver: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("¿Eliminar esta conversación y todos sus mensajes? Esta acción no se puede deshacer.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="conversacion_id" value={id} />
      <input type="hidden" name="volver" value={volver} />
      <button
        type="submit"
        className="font-semibold text-coral underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-coral/40"
      >
        🗑 Eliminar
      </button>
    </form>
  );
}
