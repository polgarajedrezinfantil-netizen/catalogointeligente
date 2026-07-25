"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { guardarEtapa, guardarSeguimiento } from "./actions";
import { ETAPAS, cuandoToca, type Etapa } from "./etapas";

function Enviar({ children, className }: { children: React.ReactNode; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={`${className} disabled:opacity-50`}>
      {pending ? "…" : children}
    </button>
  );
}

const ATAJOS = [
  { dias: 0, txt: "Hoy" },
  { dias: 1, txt: "Mañana" },
  { dias: 3, txt: "En 3 días" },
  { dias: 7, txt: "En 1 semana" },
];

export function Seguimiento({
  celular,
  fecha,
  nota,
  etapa,
  etapaManual,
  hoy,
}: {
  celular: string;
  fecha: string | null;
  nota: string | null;
  etapa: string;
  etapaManual: boolean;
  hoy: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const toca = cuandoToca(fecha, hoy);

  return (
    <section className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-titulo text-coral">Seguimiento</h2>
        {toca ? (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              toca.vencido ? "bg-coral/20 text-coral" : "bg-miel text-[#7a5a14]"
            }`}
          >
            Le toca {toca.txt}
          </span>
        ) : (
          <span className="text-xs text-cacao">Sin fecha agendada</span>
        )}
      </div>

      {nota && <p className="mt-1 text-sm text-texto">“{nota}”</p>}

      {/* Atajos: un toque y queda agendado */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {ATAJOS.map((a) => (
          <form key={a.dias} action={guardarSeguimiento}>
            <input type="hidden" name="celular" value={celular} />
            <input type="hidden" name="dias" value={a.dias} />
            <input type="hidden" name="seguimiento_nota" value={nota ?? ""} />
            <Enviar className="rounded-full border border-miel-borde px-2.5 py-1 text-xs font-semibold text-cacao hover:bg-crema">
              {a.txt}
            </Enviar>
          </form>
        ))}
        <button
          onClick={() => setAbierto(!abierto)}
          className="rounded-full border border-miel-borde px-2.5 py-1 text-xs font-semibold text-cacao"
        >
          {abierto ? "Cerrar" : "Otra fecha / nota"}
        </button>
        {fecha && (
          <form action={guardarSeguimiento}>
            <input type="hidden" name="celular" value={celular} />
            <input type="hidden" name="fecha" value="" />
            <Enviar className="rounded-full px-2.5 py-1 text-xs font-semibold text-cacao underline">
              Quitar
            </Enviar>
          </form>
        )}
      </div>

      {abierto && (
        <form action={guardarSeguimiento} className="mt-2 space-y-2 rounded-xl bg-crema/60 p-3">
          <input type="hidden" name="celular" value={celular} />
          <label className="block text-xs font-semibold text-cacao">
            Fecha
            <input
              type="date"
              name="fecha"
              defaultValue={fecha ?? ""}
              className="mt-1 block w-full rounded-lg border border-miel-borde bg-white px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-xs font-semibold text-cacao">
            ¿De qué le hablas?
            <input
              name="seguimiento_nota"
              defaultValue={nota ?? ""}
              placeholder="Preguntar si le quedó el vestido"
              className="mt-1 block w-full rounded-lg border border-miel-borde bg-white px-2 py-1.5 text-sm font-normal"
            />
          </label>
          <Enviar className="rounded-full bg-durazno px-3 py-1 text-sm font-bold text-white">
            Agendar
          </Enviar>
        </form>
      )}

      {/* Etapa: automática salvo que la tienda decida otra cosa */}
      <div className="mt-3 border-t border-miel-borde pt-3">
        <p className="text-xs font-semibold text-cacao">
          Etapa {etapaManual ? "(fijada a mano)" : "(automática)"}
        </p>
        <p className="mt-0.5 text-[11px] text-cacao">
          {ETAPAS[(etapa as Etapa) ?? "nuevo"]?.ayuda}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(Object.keys(ETAPAS) as Etapa[]).map((e) => (
            <form key={e} action={guardarEtapa}>
              <input type="hidden" name="celular" value={celular} />
              <input type="hidden" name="etapa" value={e} />
              <Enviar
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  etapa === e ? ETAPAS[e].cls : "border border-miel-borde text-cacao"
                }`}
              >
                {ETAPAS[e].nombre}
              </Enviar>
            </form>
          ))}
          {etapaManual && (
            <form action={guardarEtapa}>
              <input type="hidden" name="celular" value={celular} />
              <input type="hidden" name="etapa" value="" />
              <Enviar className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-cacao underline">
                Volver a automática
              </Enviar>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
