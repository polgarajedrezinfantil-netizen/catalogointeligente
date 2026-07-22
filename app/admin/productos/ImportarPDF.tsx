"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { urlFoto, BUCKET } from "@/lib/fotos";
import type { Campo, Linea, Nido } from "@/lib/tipos";
import { crearProductosImportados, type EstadoRapido } from "./actions";

// pdf.js (lectura del PDF en el navegador). El worker se carga del CDN.
const PDFJS_VER = "4.8.69";

const inputCls = "rounded-lg border border-miel-borde bg-crema px-2 py-1 text-sm";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

type Fila = {
  key: string;
  fotoPath: string | null;
  nombre: string;
  precio: string;
  stock: string;
  genero: string;
  talla: string;
  linea_id: string;
  nido_sel: string; // id de nido, "__nuevo__" o ""
  nidoRaw: string;
};

export function ImportarPDF({
  tiendaId,
  lineas,
  campos,
  nidos,
}: {
  tiendaId: string;
  lineas: Linea[];
  campos: Campo[];
  nidos: Nido[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [nuevoNido, setNuevoNido] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [estado, setEstado] = useState<EstadoRapido>(null);

  function reconstruirLineas(tc: { items: { str: string; transform: number[]; height?: number }[] }) {
    const items = tc.items.filter((it) => it.str && it.str.trim());
    const filas: { y: number; items: typeof items }[] = [];
    for (const it of items) {
      const y = Math.round(it.transform[5]);
      let f = filas.find((r) => Math.abs(r.y - y) < 4);
      if (!f) { f = { y, items: [] }; filas.push(f); }
      f.items.push(it);
    }
    filas.sort((a, b) => b.y - a.y);
    return filas.map((f) => ({
      texto: f.items
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map((i) => i.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
      // Altura de letra de la fila (para detectar el título grande).
      alto: Math.max(...f.items.map((i) => i.height || Math.abs(i.transform[3]) || 0)),
    }));
  }

  function valorDe(lns: string[], re: RegExp) {
    let val = "";
    for (const ln of lns) {
      const m = ln.match(re);
      if (m && m.index != null) {
        const v = ln.slice(m.index + m[0].length).replace(/^[:\s]+/, "").trim();
        if (v) val = v;
      }
    }
    return val;
  }

  // Si la plantilla no trae la fila "Nombre" (el nombre va como título grande),
  // tomamos la fila con la letra más alta que no sea etiqueta, chip ni número.
  function nombreTitulo(filas: { texto: string; alto: number }[]): string {
    let mejor = "";
    let mAlto = 0;
    for (const f of filas) {
      const t = f.texto.trim();
      const n = norm(t);
      if (t.length < 3) continue;
      if (/(linea|nido|sexo|precio|stock|talla|nombre|producto|disponible)/.test(n)) continue;
      if (lineas.some((l) => norm(l.nombre) === n)) continue; // chip de la línea
      if (/^[\d$.,\s\-–—]+$/.test(t)) continue; // números o precios sueltos
      if (f.alto > mAlto) { mAlto = f.alto; mejor = t; }
    }
    return mejor;
  }

  function parsear(filas: { texto: string; alto: number }[]) {
    const lns = filas.map((f) => f.texto);
    const nombre = valorDe(lns, /nomn?bre/i) || nombreTitulo(filas);
    const precioRaw = valorDe(lns, /precio/i);
    const stockRaw = valorDe(lns, /stock/i);
    const sexo = valorDe(lns, /sexo/i);
    const talla = valorDe(lns, /talla/i);
    const nidoRaw = valorDe(lns, /nido/i);
    const lineaRaw = valorDe(lns, /l[ií]nea de venta/i);

    const precio = (precioRaw.match(/[\d][\d.,]*/) || ["0"])[0].replace(/,/g, "");
    const stockM = stockRaw.match(/\d+/);
    const stock = stockM ? stockM[0] : "1";

    const ns = norm(sexo);
    const genero = /mami/.test(ns) ? "mami" : /unisex/.test(ns) ? "unisex" : /nina/.test(ns) ? "nina" : /nino/.test(ns) ? "nino" : "";

    const linea = lineas.find((l) => norm(l.nombre) === norm(lineaRaw));
    const nidoMatch = nidos.find((n) => norm(n.nombre) === norm(nidoRaw));
    const nido_sel = norm(nidoRaw) === "nuevo" ? "__nuevo__" : nidoMatch ? nidoMatch.id : "";

    return { nombre, precio, stock, genero, talla, linea_id: linea?.id ?? "", nido_sel, nidoRaw };
  }

  // Saca la foto ORIGINAL embebida en la página (la imagen más grande del PDF).
  // Así la foto queda limpia y a toda resolución, sin importar el diseño de la
  // plantilla. Si la página no trae imagen (o es muy chica), devolvemos null y
  // se usa el recorte del lienzo como plan B.
  async function extraerFotoEmbebida(
    pdfjs: { OPS: { paintImageXObject: number; paintImageXObjectRepeat: number } },
    page: {
      getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
      objs: { get(n: string, cb: (o: unknown) => void): void };
      commonObjs: { get(n: string, cb: (o: unknown) => void): void };
    },
  ): Promise<Blob | null> {
    type ObjImagen = { width?: number; height?: number; bitmap?: ImageBitmap; data?: Uint8ClampedArray };
    const ops = await page.getOperatorList();
    const nombres: string[] = [];
    for (let i = 0; i < ops.fnArray.length; i++) {
      if (
        ops.fnArray[i] === pdfjs.OPS.paintImageXObject ||
        ops.fnArray[i] === pdfjs.OPS.paintImageXObjectRepeat
      ) {
        nombres.push(String(ops.argsArray[i][0]));
      }
    }
    let mejor: { width: number; height: number; bitmap?: ImageBitmap; data?: Uint8ClampedArray } | null = null;
    for (const nombre of new Set(nombres)) {
      const obj = (await new Promise<unknown>((res) => {
        try {
          const bolsa = nombre.startsWith("g_") ? page.commonObjs : page.objs;
          bolsa.get(nombre, (o) => res(o));
        } catch {
          res(null);
        }
      })) as ObjImagen | null;
      if (!obj || !obj.width || !obj.height) continue;
      if (!mejor || obj.width * obj.height > mejor.width * mejor.height) {
        mejor = { width: obj.width, height: obj.height, bitmap: obj.bitmap, data: obj.data };
      }
    }
    // Menos de ~300x300 es un icono/logo de la plantilla, no la foto.
    if (!mejor || mejor.width * mejor.height < 90000) return null;

    const canvas = document.createElement("canvas");
    canvas.width = mejor.width;
    canvas.height = mejor.height;
    const ctx = canvas.getContext("2d")!;
    if (mejor.bitmap) {
      ctx.drawImage(mejor.bitmap, 0, 0, mejor.width, mejor.height);
    } else if (mejor.data) {
      const n = mejor.width * mejor.height;
      const rgba = new Uint8ClampedArray(n * 4);
      if (mejor.data.length === n * 4) {
        rgba.set(mejor.data);
      } else if (mejor.data.length === n * 3) {
        for (let p = 0, q = 0; q < rgba.length; p += 3, q += 4) {
          rgba[q] = mejor.data[p];
          rgba[q + 1] = mejor.data[p + 1];
          rgba[q + 2] = mejor.data[p + 2];
          rgba[q + 3] = 255;
        }
      } else {
        return null;
      }
      ctx.putImageData(new ImageData(rgba, mejor.width, mejor.height), 0, 0);
    } else {
      return null;
    }
    return new Promise((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.9));
  }

  async function recortarFoto(canvas: HTMLCanvasElement): Promise<Blob | null> {
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width, H = canvas.height;
    const scanH = Math.floor(H * 0.66);
    const data = ctx.getImageData(0, 0, W, scanH).data;
    let minX = W, minY = scanH, maxX = 0, maxY = 0, found = false;
    const step = 2;
    for (let y = 0; y < scanH; y += step) {
      for (let x = 0; x < W; x += step) {
        const idx = (y * W + x) * 4;
        if (data[idx + 3] > 10 && (data[idx] < 242 || data[idx + 1] < 242 || data[idx + 2] < 242)) {
          found = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    let sx = 0, sy = 0, sw = W, sh = scanH;
    if (found) {
      const pad = Math.round(W * 0.02);
      sx = Math.max(0, minX - pad);
      sy = Math.max(0, minY - pad);
      sw = Math.min(W, maxX + pad) - sx;
      sh = Math.min(scanH, maxY + pad) - sy;
    }
    const out = document.createElement("canvas");
    out.width = sw;
    out.height = sh;
    out.getContext("2d")!.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    return new Promise((res) => out.toBlob((b) => res(b), "image/jpeg", 0.85));
  }

  async function procesar(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setEstado(null);
    setProgreso("Cargando lector de PDF…");

    // pdf.js dinámico (solo en el navegador).
    const pdfjs: any = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VER}/build/pdf.worker.min.mjs`;

    const nuevas: Fila[] = [];
    for (const file of files) {
      const buf = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: buf }).promise;
      for (let n = 1; n <= pdf.numPages; n++) {
        setProgreso(`Leyendo ${file.name} — página ${n}/${pdf.numPages}…`);
        const page = await pdf.getPage(n);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;

        const datos = parsear(reconstruirLineas(await page.getTextContent()));

        let fotoPath: string | null = null;
        try {
          const blob =
            (await extraerFotoEmbebida(pdfjs, page)) ?? (await recortarFoto(canvas));
          if (blob) {
            const path = `${tiendaId}/importados/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
            const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
            if (!error) fotoPath = path;
          }
        } catch {
          /* sin foto si algo falla */
        }

        nuevas.push({ key: `${Date.now()}-${n}-${Math.random()}`, fotoPath, ...datos });
      }
    }
    setFilas((f) => [...f, ...nuevas]);
    setProgreso(null);
  }

  function setCampo(key: string, campo: keyof Fila, val: string) {
    setFilas((f) => f.map((r) => (r.key === key ? { ...r, [campo]: val } : r)));
  }

  const hayNuevo = filas.some((r) => r.nido_sel === "__nuevo__");

  // La talla se guarda en el campo de la línea que se llame Talla (o Número /
  // Edad, según el rubro) para que salga en la tarjeta y el detalle.
  function atributosDe(r: Fila): Record<string, string> {
    const t = r.talla.trim();
    if (!t || !r.linea_id) return {};
    const deLinea = campos.filter((c) => c.linea_id === r.linea_id && !c.archivado);
    const campo =
      deLinea.find((c) => norm(c.nombre).includes("talla")) ??
      deLinea.find((c) => norm(c.nombre).includes("numero")) ??
      deLinea.find((c) => norm(c.nombre).includes("edad"));
    return campo ? { [campo.id]: t } : {};
  }

  async function crear() {
    setGuardando(true);
    setEstado(null);
    const payload = {
      nuevoNidoNombre: nuevoNido,
      items: filas.map((r) => ({
        nombre: r.nombre,
        precio: Number(r.precio) || 0,
        stock: Number(r.stock) || 1,
        genero: r.genero || null,
        linea_id: r.linea_id || null,
        nido_id: r.nido_sel === "__nuevo__" || r.nido_sel === "" ? null : r.nido_sel,
        nido_nuevo: r.nido_sel === "__nuevo__",
        fotoPath: r.fotoPath,
        atributos: atributosDe(r),
      })),
    };
    const fd = new FormData();
    fd.set("payload", JSON.stringify(payload));
    const res = await crearProductosImportados(fd);
    setGuardando(false);
    setEstado(res);
    if (res?.ok) {
      setFilas([]);
      setNuevoNido("");
      router.refresh();
    }
  }

  return (
    <details className="rounded-[var(--radius-marca)] border border-miel-borde bg-white p-4">
      <summary className="cursor-pointer font-titulo text-lg text-coral">📥 Cargar productos (PDF)</summary>
      <p className="mb-3 mt-2 text-sm text-cacao">
        Sube uno o varios PDF (una prenda por página, con su foto y los datos
        Línea/Nido/Sexo/Nombre/Precio/Stock/Talla). Leemos todo, lo revisas y se
        crean como productos; la foto se saca limpia y en tamaño original. Nido
        que diga <strong>nuevo</strong> crea un Nido nuevo.
      </p>

      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-verde-mielina px-4 py-2 text-sm font-bold text-white">
        📄 Elegir PDF
        <input type="file" accept="application/pdf" multiple onChange={procesar} className="hidden" />
      </label>
      {progreso && <p className="mt-2 text-sm text-cacao">{progreso}</p>}

      {filas.length > 0 && (
        <div className="mt-4 space-y-3">
          {filas.map((r) => (
            <div key={r.key} className="flex flex-wrap items-center gap-2 rounded-xl border border-miel-borde bg-crema p-2">
              <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-white">
                {r.fotoPath && <Image src={urlFoto(r.fotoPath)} alt="" fill sizes="56px" className="object-cover" />}
              </div>
              <input value={r.nombre} onChange={(e) => setCampo(r.key, "nombre", e.target.value)} placeholder="Nombre" className={`${inputCls} min-w-36 flex-1`} />
              <input value={r.precio} onChange={(e) => setCampo(r.key, "precio", e.target.value)} type="number" placeholder="Precio" className={`${inputCls} w-20`} />
              <input value={r.stock} onChange={(e) => setCampo(r.key, "stock", e.target.value)} type="number" placeholder="Stock" className={`${inputCls} w-16`} />
              <input value={r.talla} onChange={(e) => setCampo(r.key, "talla", e.target.value)} placeholder="Talla" className={`${inputCls} w-20`} />
              <select value={r.genero} onChange={(e) => setCampo(r.key, "genero", e.target.value)} className={inputCls}>
                <option value="">Sexo…</option>
                <option value="nino">Niño</option>
                <option value="nina">Niña</option>
                <option value="unisex">Unisex</option>
                <option value="mami">Mami</option>
              </select>
              <select value={r.linea_id} onChange={(e) => setCampo(r.key, "linea_id", e.target.value)} className={inputCls}>
                <option value="">Línea…</option>
                {lineas.map((l) => (
                  <option key={l.id} value={l.id}>{l.icono} {l.nombre}</option>
                ))}
              </select>
              <select value={r.nido_sel} onChange={(e) => setCampo(r.key, "nido_sel", e.target.value)} className={inputCls} title={r.nidoRaw ? `PDF: ${r.nidoRaw}` : ""}>
                <option value="">Sin nido</option>
                {nidos.map((n) => (
                  <option key={n.id} value={n.id}>{n.nombre}</option>
                ))}
                <option value="__nuevo__">➕ Nido nuevo</option>
              </select>
              <button onClick={() => setFilas((f) => f.filter((x) => x.key !== r.key))} aria-label="Quitar" className="text-durazno">✕</button>
            </div>
          ))}

          {hayNuevo && (
            <label className="block text-sm font-semibold text-cacao">
              Nombre del Nido nuevo
              <input value={nuevoNido} onChange={(e) => setNuevoNido(e.target.value)} placeholder="Ej. Otoño 2026" className={`mt-1 block w-64 ${inputCls}`} />
            </label>
          )}

          <div className="flex items-center gap-3">
            <button onClick={crear} disabled={guardando} className="rounded-full bg-verde-mielina px-6 py-2 font-bold text-white disabled:opacity-60">
              {guardando ? "Creando…" : `Crear ${filas.length} producto(s)`}
            </button>
            <button onClick={() => setFilas([])} className="text-sm text-cacao underline">Descartar</button>
            {estado && <span className={`text-sm ${estado.ok ? "text-[#3f5a1c]" : "text-durazno"}`}>{estado.mensaje}</span>}
          </div>
        </div>
      )}
    </details>
  );
}
