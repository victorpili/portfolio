import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';
import { ErroMotor, ErroSchema, ErroSemCredito, type Chamada, type Motor, type RespostaMotor } from './motor';

/** Preço em USD por 1M de tokens. */
export const PRECOS: Record<string, { entrada: number; saida: number }> = {
  'claude-opus-5-5': { entrada: 4, saida: 20 },
  'claude-sonnet-5-5': { entrada: 2, saida: 10 },
  'claude-haiku-5-5': { entrada: 0.10, saida: 0.50 },
};

export function custoUsd(modelo: string, usage: { input_tokens: number; output_tokens: number }): number {
  const preco = PRECOS[modelo];
  if (!preco) throw new Error(`modelo sem preço: ${modelo}`);
  return (usage.input_tokens * preco.entrada + usage.output_tokens * preco.saida) / 1_000_000;
}

export function traduzirErroApi(e: unknown): Error {
  if (e instanceof Anthropic.APIError && (e.status === 400 || e.status === 402) && /credit balance/i.test(e.message)) {
    return new ErroSemCredito(e.message, { cause: e });
  }
  return new ErroMotor(e instanceof Error ? e.message : String(e), { cause: e });
}

/**
 * `zodOutputFormat` que devolve null em vez de lançar quando o texto não passa no schema.
 * Assim, resposta fora do formato chega como `parsed_output` nulo (ErroSchema) e não se confunde com erro de rede.
 */
function formatoTolerante<T>(schema: z.ZodType<T>) {
  const formato = zodOutputFormat(schema);
  return {
    ...formato,
    parse: (texto: string): T | null => {
      try {
        return formato.parse(texto);
      } catch {
        return null;
      }
    },
  };
}

export function motorApi(o: { modelo: string; esforco?: 'low' | 'medium' | 'high'; cliente?: Anthropic }): Motor {
  if (!PRECOS[o.modelo]) throw new Error(`modelo sem preço: ${o.modelo}`);
  const cliente = o.cliente ?? new Anthropic();
  const esforco = o.esforco ?? 'low';
  return {
    nome: 'api',
    modelo: o.modelo,
    async chamar<T>(c: Chamada<T>): Promise<RespostaMotor<T>> {
      const inicio = Date.now();
      const messages: Anthropic.Beta.BetaMessageParam[] = c.mensagens.map((m) => ({
        role: m.papel === 'usuario' ? 'user' : 'assistant',
        content: m.texto,
      }));
      let r;
      try {
        // Beta só pelos fallbacks do servidor: se o modelo recusar, a API tenta o modelo reserva na mesma chamada.
        r = await cliente.beta.messages.parse(
          {
            model: o.modelo,
            max_tokens: 16000,
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
            system: c.sistema,
            messages,
            thinking: { type: 'adaptive' },
            output_config: { effort: esforco, format: formatoTolerante(c.schema) },
          },
          { timeout: 45_000, maxRetries: 1, signal: c.sinal },
        );
      } catch (e) {
        throw traduzirErroApi(e);
      }
      if (r.stop_reason === 'refusal') throw new ErroSchema(`o ${c.agente} recusou a tarefa`);
      if (r.parsed_output === null) throw new ErroSchema(`resposta do ${c.agente} fora do formato`);
      return {
        dados: r.parsed_output,
        tokensEntrada: r.usage.input_tokens,
        tokensSaida: r.usage.output_tokens,
        custoUsd: custoUsd(o.modelo, r.usage),
        ms: Date.now() - inicio,
      };
    },
  };
}
