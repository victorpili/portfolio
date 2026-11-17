import type { NaturezaProcesso } from "../processos/types";

export interface DashboardKpis {
  total_recebido_cents: number;
  total_pago_saidas_cents: number;
  /** Lucro garantido — entradas recebidas − saídas pagas (somente o realizado). */
  resultado_liquido_cents: number;
  /** Lucro garantido − saídas incertas (pendentes do período). */
  pior_cenario_cents: number;
  /** Lucro garantido + entradas incertas (pendentes do período). */
  melhor_cenario_cents: number;
  ticket_medio_cents: number | null; // null when no cliente paid in the period
  inadimplencia_total_cents: number;
  num_clientes_pagantes: number;
}

/** Which projection model the Fluxo Mensal chart applies from today onward. */
export type ChartScenario = "garantido" | "pior" | "melhor";

export interface MesFluxo {
  ano_mes: string; // YYYY-MM
  /** Realised: paid entradas/saídas anchored by data_pagamento. */
  entradas_pagas_cents: number;
  saidas_pagas_cents: number;
  /** Forward: pending lançamentos from today on, by garantido flag. */
  entradas_prev_garantidas_cents: number;
  entradas_prev_incertas_cents: number;
  saidas_prev_garantidas_cents: number;
  saidas_prev_incertas_cents: number;
}

export interface GrupoReceita {
  grupo_id: string;
  grupo_nome: string;
  total_cents: number;
}

export interface ConcentracaoCliente {
  cliente_id: string;
  cliente_nome: string;
  total_cents: number;
  pct: number; // 0..1 of the period total
}

export interface ConcentracaoResult {
  clientes: ConcentracaoCliente[];
  total_cents: number;
  /** True when ≥ 3 paying clientes exist AND the top one exceeds 40%. */
  alert_eligible: boolean;
  top: ConcentracaoCliente | null;
}

export interface RecebivelItem {
  lancamento_id: string;
  parcela_numero: number | null;
  descricao: string | null;
  tipo: string;
  cliente_nome: string;
  valor_cents: number;
  data_prevista: string;
}

export interface RecebiveisProximos {
  dias: number;
  total_cents: number;
  itens: RecebivelItem[];
}

export interface InadimplenciaItem {
  lancamento_id: string;
  parcela_numero: number | null;
  cliente_nome: string;
  contrato_codigo: string | null;
  processo_numero: string | null;
  processo_natureza: NaturezaProcesso | null;
  valor_cents: number;
  data_prevista: string;
  dias_atrasado: number;
}

export interface HorizonteProjecao {
  meses: number; // 3 | 6 | 12
  garantidas_cents: number;
  nao_garantidas_ponderadas_cents: number;
  saidas_cents: number;
  resultado_cents: number;
}

export interface SemChanceItem {
  lancamento_id: string;
  processo_id: string | null;
  descricao: string | null;
  tipo: string;
  cliente_nome: string;
  valor_cents: number; // total future valor of the lancamento within 12 months
}

export interface ProjecaoResult {
  horizontes: HorizonteProjecao[]; // 3, 6, 12
  sem_chance: SemChanceItem[];
  /** Per-cliente entrada contribution (garantida + ponderada) by horizon — feeds the simulador. */
  por_cliente: {
    cliente_id: string;
    cliente_nome: string;
    contrib: Record<number, number>; // meses → cents
  }[];
}

export type SimuladorModo = "novo_contrato" | "despesa_fixa" | "perda_cliente";

export type IndicadorProjecao = "saudavel" | "atencao" | "critico";

export interface SimuladorResult {
  baseline: Record<number, number>; // meses → resultado cents
  delta: Record<number, number>;
  novo: Record<number, number>;
  indicador: IndicadorProjecao;
}
