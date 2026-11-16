import type { Agente, Sala } from '@nave/shared';

/** Posição na grade da nave, em tiles (o canto de cima à esquerda do tile). */
export type Ponto = { x: number; y: number };
export type Retangulo = { x: number; y: number; w: number; h: number };

export const GRADE = { colunas: 24, linhas: 14 } as const;

/**
 * Linha de cima: Pesquisa | Criação | Qualidade. Faixa do corredor no meio. Linha de baixo: Dormitório | Ponte.
 * A primeira linha de cada sala é a parede do fundo. A porta fica na borda que encosta no corredor.
 * `local` e `destino` dão a preposição certa no texto: "no Dormitório", "a caminho da Ponte".
 */
export const SALAS: Record<Sala, Retangulo & { nome: string; porta: Ponto; local: string; destino: string }> = {
  pesquisa: { x: 0, y: 0, w: 8, h: 6, nome: 'Pesquisa', porta: { x: 4, y: 5 }, local: 'na Pesquisa', destino: 'da Pesquisa' },
  criacao: { x: 8, y: 0, w: 8, h: 6, nome: 'Criação', porta: { x: 12, y: 5 }, local: 'na Criação', destino: 'da Criação' },
  qualidade: { x: 16, y: 0, w: 8, h: 6, nome: 'Qualidade', porta: { x: 20, y: 5 }, local: 'na Qualidade', destino: 'da Qualidade' },
  dormitorio: { x: 0, y: 8, w: 11, h: 6, nome: 'Dormitório', porta: { x: 9, y: 8 }, local: 'no Dormitório', destino: 'do Dormitório' },
  ponte: { x: 11, y: 8, w: 13, h: 6, nome: 'Ponte', porta: { x: 12, y: 8 }, local: 'na Ponte', destino: 'da Ponte' },
};

export const CORREDOR: Retangulo = { x: 0, y: 6, w: 24, h: 2 };

/** Cada agente tem uma cama no dormitório e um posto na sala onde trabalha; a mesa fica à direita do posto. */
export const POSTOS: Record<Agente, Partial<Record<Sala, Ponto>>> = {
  capita: { dormitorio: { x: 1, y: 12 }, ponte: { x: 16, y: 11 } },
  imediato: { dormitorio: { x: 3, y: 12 }, ponte: { x: 19, y: 10 } },
  pesquisador: { dormitorio: { x: 5, y: 12 }, pesquisa: { x: 4, y: 3 } },
  redator: { dormitorio: { x: 7, y: 12 }, criacao: { x: 12, y: 3 } },
  revisor: { dormitorio: { x: 9, y: 12 }, qualidade: { x: 20, y: 3 } },
};

/** Onde o agente fica na sala. Sala sem posto dele (não acontece numa missão): a porta. */
export function posto(agente: Agente, sala: Sala): Ponto {
  return POSTOS[agente][sala] ?? SALAS[sala].porta;
}

/** O tile do corredor colado na porta. */
function entrada(porta: Ponto): Ponto {
  return { x: porta.x, y: porta.y < CORREDOR.y ? CORREDOR.y : CORREDOR.y + CORREDOR.h - 1 };
}

const mesmoPonto = (a: Ponto, b: Ponto) => a.x === b.x && a.y === b.y;

/**
 * Caminho de uma sala a outra: posto → porta → corredor → porta → posto.
 * No corredor, anda na faixa da porta de saída e só troca de faixa ao chegar na coluna da porta de entrada.
 */
export function rota(agente: Agente, de: Sala, para: Sala): Ponto[] {
  if (de === para) return [posto(agente, para)];
  const saida = SALAS[de].porta;
  const chegada = SALAS[para].porta;
  const a = entrada(saida);
  const b = entrada(chegada);
  const pontos = [posto(agente, de), saida, a, { x: b.x, y: a.y }, b, chegada, posto(agente, para)];
  return pontos.filter((p, i) => i === 0 || !mesmoPonto(p, pontos[i - 1]));
}

export type PlanoDeMovimento = { tipo: 'parado' } | { tipo: 'caminhar'; pontos: Ponto[] } | { tipo: 'saltar'; posto: Ponto };

/**
 * O que o agente faz quando a sala muda. Parado, caminha pela rota. Se a sala muda no meio de uma caminhada
 * (por exemplo, a missão recomeça) ou com movimento reduzido, salta direto ao posto novo, sem atravessar paredes.
 */
export function planoDeMovimento(
  agente: Agente, de: Sala, para: Sala, o: { andando: boolean; reduzido: boolean },
): PlanoDeMovimento {
  if (de === para) return { tipo: 'parado' };
  if (o.andando || o.reduzido) return { tipo: 'saltar', posto: posto(agente, para) };
  return { tipo: 'caminhar', pontos: rota(agente, de, para) };
}
