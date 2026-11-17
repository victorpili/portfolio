export type Natureza = "entrada" | "saida";

export type TipoEntrada =
  | "mensalidade"
  | "pagamento_unico"
  | "sucumbencia"
  | "acordo"
  | "reembolso_custas";

export type TipoSaida = "despesa_escritorio" | "custas_processuais" | "reembolso_cliente";

export type TipoLancamento = TipoEntrada | TipoSaida;

export type FormaPagamento = "avista" | "parcelado";

export type StatusPagamento =
  | "pendente"
  | "pago"
  | "parcialmente_pago"
  | "cancelado"
  | "inadimplente";

export type StatusParcela = "pendente" | "pago" | "inadimplente";

export interface Lancamento {
  id: string;
  descricao: string | null;
  natureza: Natureza;
  cliente_id: string;
  contrato_id: string | null;
  processo_id: string | null;
  tipo: TipoLancamento;
  centro_custo_id: string | null;
  garantido: number; // 0 | 1
  forma_pagamento: FormaPagamento;
  num_parcelas: number | null;
  valor: number; // cents — total for avista, per-parcela for parcelado
  data_prevista: string | null; // avista only
  data_pagamento: string | null; // avista only
  status_pagamento: StatusPagamento;
  numero_documento: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Parcela {
  id: string;
  lancamento_id: string;
  numero: number;
  valor: number;
  data_prevista: string;
  data_pagamento: string | null;
  status: StatusParcela;
  observacoes: string | null;
}

/** Input for create/update. `data_primeira_parcela` is used only for parcelado. */
export interface LancamentoInput {
  descricao: string | null;
  natureza: Natureza;
  cliente_id: string;
  contrato_id: string | null;
  processo_id: string | null;
  tipo: TipoLancamento;
  centro_custo_id: string | null;
  garantido: boolean;
  forma_pagamento: FormaPagamento;
  num_parcelas: number | null;
  valor: number;
  data_prevista: string | null; // avista
  data_primeira_parcela: string | null; // parcelado
  data_pagamento: string | null; // avista
  status_pagamento: StatusPagamento;
  numero_documento: string | null;
  observacoes: string | null;
}

export interface LancamentoListFilters {
  search?: string;
  cliente_id?: string;
  contrato_id?: string;
  processo_id?: string;
  natureza?: Natureza | "all";
  tipo?: TipoLancamento | "all";
  status_pagamento?: StatusPagamento | "all";
  centro_custo_id?: string;
  garantido?: boolean;
  data_de?: string;
  data_ate?: string;
}

/** A lancamento row enriched for list display. `status_efetivo` reflects computed inadimplência. */
export interface LancamentoListRow extends Lancamento {
  cliente_nome: string;
  contrato_codigo: string | null;
  status_efetivo: StatusPagamento;
  /** Sum of parcelas valor for parcelado; equals `valor` for avista. */
  valor_total: number;
}

/** A lancamento plus its parcelas (parcelado) for the detail page. */
export interface LancamentoComParcelas extends Lancamento {
  parcelas: Parcela[];
}
