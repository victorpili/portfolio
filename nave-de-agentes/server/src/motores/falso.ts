import { ErroSchema, type Chamada, type Motor, type NomeAgente, type RespostaMotor } from './motor';

/**
 * Motor de teste: cada agente tem uma fila de respostas, entregues na ordem.
 * Um item `Error` é lançado; um item fora do schema vira `ErroSchema`; fila vazia é erro do teste.
 */
export function motorFalso(roteiro: Partial<Record<NomeAgente, unknown[]>>): Motor & { chamadas: Chamada<unknown>[] } {
  const filas: Record<NomeAgente, unknown[]> = {
    pesquisador: [...(roteiro.pesquisador ?? [])],
    redator: [...(roteiro.redator ?? [])],
    revisor: [...(roteiro.revisor ?? [])],
  };
  const chamadas: Chamada<unknown>[] = [];
  return {
    nome: 'falso',
    modelo: 'falso',
    chamadas,
    async chamar<T>(c: Chamada<T>): Promise<RespostaMotor<T>> {
      chamadas.push(c);
      const fila = filas[c.agente];
      if (fila.length === 0) throw new Error('roteiro acabou');
      const item = fila.shift();
      if (item instanceof Error) throw item;
      const r = c.schema.safeParse(item);
      if (!r.success) throw new ErroSchema(`resposta do ${c.agente} fora do formato: ${r.error.message}`);
      return { dados: r.data, tokensEntrada: 0, tokensSaida: 0, custoUsd: 0, ms: 0 };
    },
  };
}
