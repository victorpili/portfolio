export type TipoCliente = "pf" | "pj";
export type StatusRelacionamento = "ativo" | "inativo";
export type StatusFinanceiro = "adimplente" | "inadimplente" | "sem_movimentacao";
/** Only meaningful for PJ clients. NULL for PF. */
export type TipoUnidade = "matriz" | "filial";

export interface Cliente {
  id: string;
  tipo: TipoCliente;
  nome: string;

  cpf: string | null;
  rg: string | null;
  data_nascimento: string | null;

  cnpj: string | null;
  data_fundacao: string | null;

  email: string | null;
  telefone: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;

  origem_id: string | null;
  status_relacionamento: StatusRelacionamento;
  observacoes: string | null;

  /** PJ only: 'matriz' | 'filial'. NULL for PF. */
  tipo_unidade: TipoUnidade | null;
  /** PJ filiais only: the matriz cliente's id. NULL otherwise. */
  matriz_id: string | null;

  criado_em: string;
  atualizado_em: string;
}

export interface ContatoPJ {
  id: string;
  cliente_id: string;
  nome: string;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  observacoes: string | null;
  criado_em: string;
}

/** State registration (Inscrição Estadual) — PJ only, one per UF. */
export interface InscricaoEstadual {
  id: string;
  cliente_id: string;
  estado: string;
  inscricao: string;
  criado_em: string;
}

/** A draft inscrição estadual being edited in the cliente form. */
export interface InscricaoEstadualDraft {
  estado: string;
  inscricao: string;
}

export type ClienteInput = Omit<Cliente, "id" | "criado_em" | "atualizado_em">;
export type ContatoPJInput = Omit<ContatoPJ, "id" | "criado_em">;

export interface ClienteListFilters {
  search?: string;
  tipo?: TipoCliente | "all";
  status_relacionamento?: StatusRelacionamento | "all";
}

export interface ClienteListRow extends Cliente {
  status_financeiro: StatusFinanceiro;
}
