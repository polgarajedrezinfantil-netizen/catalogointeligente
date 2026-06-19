"use client";

import { useState } from "react";
import { SubirFotos } from "@/components/SubirFotos";
import { crearProductoIA } from "./actions";

type Candidato = {
  nombre: string;
  marca: string;
  modelo: string;
  certeza: number;
  resumen: string;
  terminos_busqueda: string;
};
type ResIA = {
  necesita_mas: boolean;
  confianza: number;
  preguntas: string[];
  candidatos: Candidato[];
  error?: string;
};
type Precio = {
  titulo: string;
  precio: number | null;
  precio_txt: string;
  fuente: string;
  link: string;
  thumbnail: string;
  coincidencia?: number; // parecido visual a la foto (0 a 1)
};

const input =
  "rounded-xl border border-miel-borde bg-crema px-3 py-2 outline-none focus:border-verde-mielina";

export function Identificador({
  tiendaId,
  gananciaDefault,
  simbolo,
}: {
  tiendaId: string;
  gananciaDefault: number;
  simbolo: string;
}) {
  const [fotos, setFotos] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);
  const [res, setRes] = useState<ResIA | null>(null);
  const [elegido, setElegido] = useState<Candidato | null>(null);

  const [precios, setPrecios] = useState<Precio[] | null>(null);
  const [stats, setStats] = useState<{ min: number; max: number; promedio: number } | null>(null);
  const [buscandoPrecio, setBuscandoPrecio] = useState(false);
  const [puntuando, setPuntuando] = useState(false); // calculando parecido visual

  // calculadora
  const [costo, setCosto] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");
  const [cantidad, setCantidad] = useState("1");

  // Corre la identificación con las fotos actuales (paso 1).
  async function correr() {
    if (fotos.length === 0) return;
    setCargando(true);
    setRes(null);
    setElegido(null);
    setPrecios(null);
    const r = await fetch("/api/identificar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fotos }),
    });
    const data = (await r.json()) as ResIA;
    setRes(data);
    setCargando(false);
  }

  async function buscarPrecios(c: Candidato) {
    setElegido(c);
    setBuscandoPrecio(true);
    setPrecios(null);
    const r = await fetch("/api/precios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: c.terminos_busqueda }),
    });
    const data = await r.json();
    const lista: Precio[] = data.precios ?? [];
    setStats(data.stats ?? null);
    // Sugerencia inicial de precio de venta a partir del promedio.
    if (data.stats?.promedio) {
      setPrecioVenta(String(data.stats.promedio));
    }
    setPrecios(lista);
    setBuscandoPrecio(false);

    // Parecido visual: puntúa cada resultado contra la foto real (best-effort)
    // y reordena por coincidencia. Si falla, los precios igual quedan visibles.
    if (fotos.length > 0 && lista.length > 0) {
      setPuntuando(true);
      try {
        const rc = await fetch("/api/coincidencia", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            foto: fotos[0],
            producto: `${c.nombre} ${c.marca} ${c.modelo}`.trim(),
            resultados: lista.map((p) => ({ titulo: p.titulo, thumbnail: p.thumbnail })),
          }),
        });
        const dc = (await rc.json()) as { coincidencias?: { indice: number; coincidencia: number }[] };
        if (Array.isArray(dc.coincidencias) && dc.coincidencias.length > 0) {
          const conScore = lista.map((p, i) => {
            const m = dc.coincidencias!.find((x) => x.indice === i);
            return { ...p, coincidencia: m?.coincidencia };
          });
          conScore.sort((a, b) => (b.coincidencia ?? -1) - (a.coincidencia ?? -1));
          setPrecios(conScore);
        }
      } catch {
        /* sin parecido: se quedan los precios tal cual */
      }
      setPuntuando(false);
    }
  }

  const ganancia = Number(precioVenta) - Number(costo);
  const margen = Number(precioVenta) > 0 ? Math.round((ganancia / Number(precioVenta)) * 100) : 0;
  // Sugerencia con % por defecto sobre el costo.
  const sugeridoPorCosto = costo ? (Number(costo) * (1 + gananciaDefault)).toFixed(2) : "";

  return (
    <div className="max-w-2xl space-y-6">
      {/* 1. Subir fotos + identificar */}
      <div className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
        <p className="mb-2 font-titulo text-coral">1) Foto del producto</p>
        <p className="mb-2 text-xs text-cacao">Toma o sube una foto clara (de frente). Puedes agregar varias.</p>
        <SubirFotos name="fotos_ident" tiendaId={tiendaId} multiple paths={fotos} onCambio={setFotos} />
        <button
          type="button"
          onClick={correr}
          disabled={cargando || fotos.length === 0}
          className="mt-3 rounded-full bg-verde-mielina px-5 py-2 font-bold text-white disabled:opacity-60"
        >
          {cargando ? "Identificando…" : "Identificar con IA"}
        </button>
      </div>

      {res?.error && <p className="text-durazno">Error: {res.error}</p>}

      {/* 2. Compuerta de confianza */}
      {res && !res.error && (
        <div className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
          <p className="mb-1 font-titulo text-coral">2) Resultado</p>
          <p className="text-sm text-cacao">
            Confianza de la mejor coincidencia:{" "}
            <strong>{Math.round(res.confianza * 100)}%</strong>
          </p>

          {/* Sugerencias para subir la certeza (solo guía, sin volver a subir foto aquí) */}
          {(res.necesita_mas || res.confianza < 0.9) && res.preguntas.length > 0 && (
            <div className="mt-3 rounded-xl bg-miel/30 p-3">
              <p className="mb-1 text-sm font-semibold text-[#7a5a14]">
                Para subir la certeza, ayuda saber:
              </p>
              <ul className="mb-2 list-disc pl-5 text-sm text-texto">
                {res.preguntas.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
              <p className="text-xs text-cacao">
                Agrega una foto de la <strong>etiqueta</strong> o el <strong>código de barras</strong> en el
                paso 1 ⤴ y vuelve a tocar <strong>Identificar con IA</strong>.
              </p>
            </div>
          )}

          {/* Candidatos para confirmación humana */}
          <div className="mt-3 space-y-2">
            {res.candidatos.map((c, i) => (
              <div
                key={i}
                className={`rounded-xl border p-3 ${
                  elegido === c ? "border-verde-mielina bg-verde-mielina/10" : "border-miel-borde"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-producto font-bold text-texto">{c.nombre}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold text-white ${
                      c.certeza >= 0.9
                        ? "bg-verde-mielina"
                        : c.certeza >= 0.6
                          ? "bg-sol text-[#7a5414]"
                          : "bg-durazno"
                    }`}
                  >
                    {Math.round(c.certeza * 100)}%
                  </span>
                </div>
                {/* Barra de coincidencia */}
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-crema">
                  <div
                    className={`h-full ${
                      c.certeza >= 0.9 ? "bg-verde-mielina" : c.certeza >= 0.6 ? "bg-sol" : "bg-durazno"
                    }`}
                    style={{ width: `${Math.round(c.certeza * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-cacao">
                  {c.marca} · {c.modelo}
                </p>
                <p className="text-sm text-texto">{c.resumen}</p>
                <button
                  onClick={() => buscarPrecios(c)}
                  className="mt-2 rounded-full bg-durazno px-4 py-1.5 text-sm font-bold text-white"
                >
                  Es este → buscar precios
                </button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-cacao">
            ⚠️ Confirma tú el producto correcto: protege tu dinero y reputación.
          </p>
        </div>
      )}

      {/* 3. Precios reales + calculadora */}
      {elegido && (
        <div className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
          <p className="mb-1 font-titulo text-coral">3) Precios reales y ganancia</p>
          {buscandoPrecio && <p className="text-cacao">Buscando precios…</p>}

          {stats && (
            <p className="text-sm text-cacao">
              Encontrados — mín: <strong>{simbolo}{stats.min}</strong> · prom:{" "}
              <strong>{simbolo}{stats.promedio}</strong> · máx:{" "}
              <strong>{simbolo}{stats.max}</strong>
            </p>
          )}
          {puntuando && (
            <p className="mt-1 text-xs text-cacao">Calculando parecido con tu foto…</p>
          )}

          {precios && precios.length > 0 && (
            <ul className="mt-2 max-h-96 space-y-2 overflow-y-auto text-sm">
              {precios.map((p, i) => (
                <li key={i} className="flex items-center gap-3 border-b border-miel-borde pb-2">
                  {/* Foto del resultado */}
                  <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-miel-borde bg-crema">
                    {p.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumbnail} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[10px] text-cacao">
                        sin foto
                      </span>
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-texto">{p.titulo}</p>
                    <p className="text-xs text-cacao">{p.fuente}</p>
                    {/* Parecido de la imagen como variable del % de coincidencia */}
                    {typeof p.coincidencia === "number" && (
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-[11px] text-cacao">parecido</span>
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-crema">
                          <span
                            className={`block h-full ${
                              p.coincidencia >= 0.8
                                ? "bg-verde-mielina"
                                : p.coincidencia >= 0.5
                                  ? "bg-sol"
                                  : "bg-durazno"
                            }`}
                            style={{ width: `${Math.round(p.coincidencia * 100)}%` }}
                          />
                        </span>
                        <span
                          className={`text-[11px] font-bold ${
                            p.coincidencia >= 0.8
                              ? "text-[#3f5a1c]"
                              : p.coincidencia >= 0.5
                                ? "text-[#7a5414]"
                                : "text-durazno"
                          }`}
                        >
                          {Math.round(p.coincidencia * 100)}%
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-bold text-[#7a5414]">
                      {p.precio_txt || (p.precio ? `${simbolo}${p.precio}` : "—")}
                    </span>
                    {p.link && (
                      <a
                        href={p.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full bg-verde-mielina px-2.5 py-0.5 text-xs font-bold text-white"
                      >
                        Abrir ↗
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Calculadora */}
          <form action={crearProductoIA} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="fotos" value={JSON.stringify(fotos)} />
            <input type="hidden" name="precios_encontrados" value={JSON.stringify(precios ?? [])} />
            <input type="hidden" name="descripcion" value={`${elegido.marca} ${elegido.modelo} — ${elegido.resumen}`} />

            <label className="text-sm font-semibold text-cacao sm:col-span-2">
              Nombre del producto
              <input name="nombre" defaultValue={elegido.nombre} className={`mt-1 w-full ${input}`} />
            </label>
            <label className="text-sm font-semibold text-cacao">
              Costo (lo que te costó)
              <input
                name="costo"
                type="number"
                step="0.01"
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
                className={`mt-1 w-full ${input}`}
              />
              {sugeridoPorCosto && !precioVenta && (
                <button
                  type="button"
                  onClick={() => setPrecioVenta(sugeridoPorCosto)}
                  className="mt-1 text-xs text-verde-mielina underline"
                >
                  Sugerir {simbolo}{sugeridoPorCosto} (+{Math.round(gananciaDefault * 100)}%)
                </button>
              )}
            </label>
            <label className="text-sm font-semibold text-cacao">
              Precio de venta
              <input
                name="precio"
                type="number"
                step="0.01"
                value={precioVenta}
                onChange={(e) => setPrecioVenta(e.target.value)}
                className={`mt-1 w-full ${input}`}
              />
            </label>

            {/* Celdas de resultado pedidas */}
            <div className="rounded-xl bg-crema p-3 text-sm sm:col-span-2">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-cacao">% de ganancia</p>
                  <p className="font-producto text-lg font-bold text-[#3f5a1c]">{margen}%</p>
                </div>
                <div>
                  <p className="text-xs text-cacao">Ganancia (neta)</p>
                  <p className="font-producto text-lg font-bold text-[#3f5a1c]">
                    {simbolo}{ganancia.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-cacao">Piezas iguales</p>
                  <input
                    name="cantidad"
                    type="number"
                    min={1}
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    className={`mt-1 w-16 text-center ${input}`}
                  />
                </div>
              </div>
              <p className="mt-1 text-center text-xs text-cacao">
                Ganancia total estimada: {simbolo}
                {(ganancia * Number(cantidad || 1)).toFixed(2)}
              </p>
            </div>

            <button className="rounded-full bg-verde-mielina px-6 py-2 font-bold text-white sm:col-span-2">
              Crear producto con estos datos
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
