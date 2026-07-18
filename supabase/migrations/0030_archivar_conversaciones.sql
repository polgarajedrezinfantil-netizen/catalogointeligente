-- 0030: archivar conversaciones del agente.
-- Permite ocultar una conversación de la bandeja sin borrarla (reversible).
-- El borrado definitivo se hace con DELETE (cascada a agente_mensajes por FK).

alter table public.agente_conversaciones
  add column if not exists archivada boolean not null default false;

-- La bandeja consulta por (tienda, archivada) ordenando por recencia.
create index if not exists idx_agente_conv_archivada
  on public.agente_conversaciones (tienda_id, archivada, ultimo_mensaje_en desc);
