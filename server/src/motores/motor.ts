import type { z } from 'zod';

export type NomeAgente = 'pesquisador' | 'redator' | 'revisor';

export interface Chamada<T> {
  agente: NomeAgente;
  sistema: string;
  mensagens: { papel: 'usuario' | 'assistente'; texto: string }[];
  schema: z.ZodType<T>;
  sinal?: AbortSignal;
}

export interface RespostaMotor<T> { dados: T; tokensEntrada: number; tokensSaida: number; custoUsd: number; ms: number }

/** Quem fala com o Claude: a API, a assinatura do Claude Code ou um falso de teste. */
export interface Motor { nome: 'api' | 'assinatura' | 'falso'; modelo: string; chamar<T>(c: Chamada<T>): Promise<RespostaMotor<T>> }

/** O que uma resposta gastou. */
export interface Gasto { custoUsd?: number; tokensEntrada?: number; tokensSaida?: number }

/** Resposta fora do formato ou recusa. Quando a resposta chegou, traz o que ela gastou (a chamada foi cobrada). */
export class ErroSchema extends Error implements Gasto {
  custoUsd?: number;
  tokensEntrada?: number;
  tokensSaida?: number;

  constructor(mensagem: string, gasto: Gasto = {}) {
    super(mensagem);
    this.custoUsd = gasto.custoUsd;
    this.tokensEntrada = gasto.tokensEntrada;
    this.tokensSaida = gasto.tokensSaida;
  }
}
export class ErroSemCredito extends Error {}
/** API fora, timeout, rede. */
export class ErroMotor extends Error {}
