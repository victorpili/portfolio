export type StatusContrato = "ativo" | "inativo" | "suspenso";

export interface Contrato {
  id: string;
  codigo: string;
  nome: string;
  cliente_id: string;
  processo_id: string | null;
  area_direito_id: string;
  tipo_contrato_id: string;
  valor_base: number;            // cents
  data_inicio: string;           // ISO YYYY-MM-DD
  data_encerramento: string | null;
  status: StatusContrato;
  link_documentos: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type ContratoInput = Omit<Contrato, "id" | "criado_em" | "atualizado_em" | "codigo"> & {
  /** When null/empty, the backend generates `CTR-YYYY-NNNN`. */
  codigo: string | null;
};

export interface ContratoListFilters {
  search?: string;
  cliente_id?: string;
  status?: StatusContrato | "all";
  area_direito_id?: string;
}

export interface ContratoListRow extends Contrato {
  cliente_nome: string;
  area_nome: string;
  tipo_nome: string;
}

export interface ContratoResumoFinanceiro {
  total_faturado_cents: number;
  total_recebido_cents: number;
  total_em_aberto_cents: number;
}
