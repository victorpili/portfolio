export type NaturezaProcesso = "judicial" | "administrativo";
export type FaseProcesso = "conhecimento" | "recurso" | "execucao" | "arquivado" | "outro";
export type StatusProcesso = "em_andamento" | "encerrado" | "suspenso";

export interface Processo {
  id: string;
  cliente_id: string;
  natureza: NaturezaProcesso;

  numero_processo: string | null;
  vara: string | null;
  tribunal: string | null;
  comarca: string | null;

  fase: FaseProcesso;
  fase_custom: string | null;

  parte_adversa: string | null;
  advogado_adversario: string | null;
  oab_adversario: string | null;

  valor_causa: number | null;       // cents
  chance_exito: number | null;      // 0-100
  link_documentos: string | null;

  status: StatusProcesso;
  observacoes: string | null;

  criado_em: string;
  atualizado_em: string;
}

export type ProcessoInput = Omit<Processo, "id" | "criado_em" | "atualizado_em">;

export interface ProcessoListFilters {
  search?: string;
  cliente_id?: string;
  status?: StatusProcesso | "all";
}

export interface ProcessoListRow extends Processo {
  cliente_nome: string;
  cliente_tipo: "pf" | "pj";
}
