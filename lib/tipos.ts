// Tipos compartidos del dominio de Mamielina (SaaS multi-tienda).

export type Rol = "superadmin" | "admin" | "delegado";

export type Perfil = {
  id: string;
  nombre: string;
  rol: Rol;
  tienda_id: string | null;
};

export type Plan = {
  clave: string;
  nombre: string;
  max_catalogos: number | null; // null = ilimitado
  orden: number;
};

export type Tienda = {
  id: string;
  slug: string;
  nombre: string;
  plan_clave: string;
  activa: boolean;
  logo_url: string | null;
  whatsapp: string | null;
  hold_horas: number;
  lista_espera_global: boolean;
  moneda: string;
  etiqueta_precio: string;
  ganancia_default: number;
  precio_general_default: number | null;
  whatsapp_api_activa: boolean;
  whatsapp_api_config: Record<string, unknown>;
  email_api_config: Record<string, unknown>;
  datos_pago: string | null;
  bio: string | null;
  direccion: string | null;
  horario: string | null;
  maps_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  subtitulo: string | null;
  descripcion: string | null;
  banner_url: string | null;
  og_titulo: string | null;
  og_descripcion: string | null;
  tema: Record<string, string>;
};

export type TipoCampo = "texto" | "numero" | "lista" | "multi" | "sino";

export const TIPOS_CAMPO: { valor: TipoCampo; etiqueta: string }[] = [
  { valor: "texto", etiqueta: "Texto" },
  { valor: "numero", etiqueta: "Número" },
  { valor: "lista", etiqueta: "Lista de opciones" },
  { valor: "multi", etiqueta: "Multi-opción" },
  { valor: "sino", etiqueta: "Sí / No" },
];

export type Linea = {
  id: string;
  tienda_id: string;
  nombre: string;
  icono: string;
  color: string;
  orden: number;
  archivada: boolean;
  lista_espera_override: boolean | null;
};

export type EstadoProducto =
  | "disponible"
  | "apartada"
  | "apartada_firme"
  | "vendida"
  | "agotada";

export type Nido = {
  id: string;
  tienda_id: string;
  nombre: string;
  fecha: string;
  foto_portada_url: string | null;
  orden: number;
  es_nuevo: boolean;
  activo: boolean;
};

export type Producto = {
  id: string;
  tienda_id: string;
  linea_id: string | null;
  nido_id: string | null;
  nombre: string;
  descripcion: string | null;
  precio: number;
  costo: number;
  cantidad: number;
  fotos: string[];
  atributos: Record<string, unknown>;
  categoria: string | null;
  genero: "nino" | "nina" | "unisex" | "mami" | null;
  estado: EstadoProducto;
  holder_celular: string | null;
  hold_expira: string | null;
  creado: string;
  oculto: boolean;
  orden: number;
  precio_oferta: number | null;
  pedido_id: string | null;
};

// Un pedido generado desde el carrito del cliente.
export type PedidoItem = { producto_id: string; nombre: string; precio: number };
export type Pedido = {
  id: string;
  tienda_id: string;
  folio: number;
  cliente_celular: string | null;
  cliente_nombre: string | null;
  cliente_correo: string | null;
  items: PedidoItem[];
  subtotal: number;
  cupon: string | null;
  descuento: number;
  total: number;
  estado: "pendiente" | "pagado" | "cancelado";
  creado: string;
  confirmado_en: string | null;
};

export type Campo = {
  id: string;
  linea_id: string;
  tienda_id: string;
  nombre: string;
  tipo: TipoCampo;
  opciones: string[];
  obligatorio: boolean;
  es_filtro: boolean;
  orden: number;
  archivado: boolean;
};
