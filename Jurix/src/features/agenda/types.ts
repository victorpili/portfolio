import type { NaturezaProcesso } from "../processos/types";

export type StatusEvento = "pendente" | "concluido" | "cancelado";

export interface AgendaEvento {
  id: string;
  titulo: string;
  tipo_evento_id: string;
  data_hora: string; // ISO-8601 local instant
  cliente_id: string | null;
  processo_id: string | null;
  contrato_id: string | null;
  alerta_dias: number;
  status: StatusEvento;
  descricao: string | null;
  criado_em: string;
}

export interface AgendaEventoInput {
  titulo: string;
  tipo_evento_id: string;
  data_hora: string;
  cliente_id: string | null;
  processo_id: string | null;
  contrato_id: string | null;
  alerta_dias: number;
  status: StatusEvento;
  descricao: string | null;
}

/** A row enriched with the linked entity names for display. */
export interface AgendaEventoRow extends AgendaEvento {
  tipo_evento_nome: string;
  cliente_nome: string | null;
  processo_numero: string | null;
  processo_natureza: NaturezaProcesso | null;
  contrato_codigo: string | null;
}

export type AgendaEntityType = "cliente" | "processo" | "contrato";
