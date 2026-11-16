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

/**
 * Embrulha o motor para somar o custo de cada chamada que voltou, inclusive recusa e resposta fora do formato
 * (o `ErroSchema` traz o custo e é relançado igual). A Capitã só registra as chamadas certas; a linha de comando
 * e o servidor precisam do total real: a gravação para por ele e o servidor o registra no log.
 */
export function contarCusto(motor: Motor): { motor: Motor; custoUsd: () => number } {
  let total = 0;
  return {
    motor: {
      nome: motor.nome,
      modelo: motor.modelo,
      async chamar<T>(c: Chamada<T>): Promise<RespostaMotor<T>> {
        try {
          const r = await motor.chamar(c);
          total += r.custoUsd;
          return r;
        } catch (e) {
          if (e instanceof ErroSchema) total += e.custoUsd ?? 0;
          throw e;
        }
      },
    },
    custoUsd: () => total,
  };
}
