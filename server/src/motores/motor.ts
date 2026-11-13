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

/** Resposta fora do formato ou recusa. */
export class ErroSchema extends Error {}
export class ErroSemCredito extends Error {}
/** API fora, timeout, rede. */
export class ErroMotor extends Error {}
