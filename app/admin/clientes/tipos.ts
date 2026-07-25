// Lo que devuelven las RPCs clientes_pagina y cliente_ficha.

export type Fila = {
  celular: string;
  nombre: string | null;
  correo: string | null;
  ultima_visita: string;
  etiquetas: string[];
  tiene_nota: boolean;
  no_molestar: boolean;
  etapa: string;
  etapa_manual: boolean;
  proximo_seguimiento: string | null;
  seguimiento_nota: string | null;
  responsable: string | null;
  pedidos: number;
  pagados: number;
  pendientes: number;
  gastado: number;
  ultimo_pedido: string | null;
  solicitudes: number;
  intereses: string[];
};

export type Conteos = Record<string, number>;

export type Pagina = {
  total: number;
  pagina: number;
  por: number;
  // El día de HOY en la zona horaria de la tienda, no la del navegador.
  hoy: string;
  filas: Fila[];
  conteos: Conteos;
};

export type Ficha = {
  hoy: string;
  cliente: {
    celular: string;
    nombre: string | null;
    correo: string | null;
    creado: string;
    ultima_visita: string;
    etiquetas: string[];
    nota: string | null;
    no_molestar: boolean;
    etapa: string;
    etapa_manual: boolean;
    proximo_seguimiento: string | null;
    seguimiento_nota: string | null;
    responsable: string | null;
    dormido: boolean;
  };
  resumen: {
    pedidos: number;
    pagados: number;
    pendientes: number;
    devueltos: number;
    gastado: number;
    ticket: number;
    primer_pedido: string | null;
    ultimo_pedido: string | null;
  };
  intereses: { nombre: string; n: number }[];
  pedidos: { id: string; folio: number; estado: string; total: number; creado: string; items: number }[];
  solicitudes: { id: string; texto: string; estado: string; creado: string }[];
  mensajes: { canal: string; cuerpo: string; hora: string }[];
  conversaciones: { id: string; canal: string | null; estado: string; ultimo: string }[];
  actividad: { tipo: string; nombre: string | null; hora: string }[];
  linea_tiempo: {
    clase: "pedido" | "solicitud" | "mensaje" | "chat" | "evento";
    titulo: string;
    detalle: string | null;
    ref: string | null;
    hora: string;
  }[];
};
