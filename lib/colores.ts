// Paleta de colores con NOMBRE para las prendas. El admin elige de aquí y el
// cliente ve el nombre (y un puntito del color) en la ficha del producto.
export type ColorNombrado = { nombre: string; hex: string };

export const COLORES: ColorNombrado[] = [
  { nombre: "Blanco", hex: "#FFFFFF" },
  { nombre: "Crema", hex: "#FCF6E8" },
  { nombre: "Beige", hex: "#E8D9B5" },
  { nombre: "Amarillo", hex: "#F4C13E" },
  { nombre: "Naranja", hex: "#F59E0B" },
  { nombre: "Coral", hex: "#E1855F" },
  { nombre: "Durazno", hex: "#ECA088" },
  { nombre: "Rojo", hex: "#E1574C" },
  { nombre: "Rosa", hex: "#F4A6C0" },
  { nombre: "Rosa fuerte", hex: "#EC4899" },
  { nombre: "Morado", hex: "#8B5CF6" },
  { nombre: "Azul cielo", hex: "#8EC5E8" },
  { nombre: "Azul", hex: "#3B82F6" },
  { nombre: "Azul marino", hex: "#1E3A8A" },
  { nombre: "Verde", hex: "#A6C972" },
  { nombre: "Verde oscuro", hex: "#4D7C3A" },
  { nombre: "Gris", hex: "#9CA3AF" },
  { nombre: "Café", hex: "#8B5E3C" },
  { nombre: "Negro", hex: "#111827" },
  { nombre: "Dorado", hex: "#D4AF37" },
  {
    nombre: "Multicolor",
    hex: "conic-gradient(from 0deg,#f87171,#fbbf24,#a3e635,#34d399,#60a5fa,#a78bfa,#f87171)",
  },
];

// Devuelve el color CSS (hex o gradiente) para pintar el puntito de un nombre.
const MAPA = new Map(COLORES.map((c) => [c.nombre.toLowerCase(), c.hex]));
export function hexDeColor(nombre: string): string | null {
  return MAPA.get(nombre.trim().toLowerCase()) ?? null;
}
