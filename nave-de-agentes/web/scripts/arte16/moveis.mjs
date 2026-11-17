// Móveis fixos: a cama de cada tripulante, a mesa de trabalho e o computador em cima dela.
import { ACO, BRANCO, CIANO, MADEIRA, VERDE } from './paleta.mjs';
import { caixa, pes } from './formas.mjs';
import { Tela } from './tela.mjs';

/** Mesa de aço: tampo claro, frente com gaveta e puxador, pés curtos e sombra embaixo. */
export function mesa() {
  const t = new Tela();
  caixa(t, 1, 5, 14, 4, 5, { luz: ACO[7], topo: ACO[6], quina: ACO[7], frente: ACO[4], sombra: ACO[3] });
  t.p(2, 6, ACO[8]).h(3, 7, 3, ACO[5]); // reflexo e um risco no tampo
  t.ret(4, 10, 8, 2, ACO[3]).h(4, 10, 8, ACO[2]).h(7, 11, 2, ACO[6]); // gaveta
  pes(t, 2, 13, 14, 1, ACO[3]);
  t.contorno();
  return t.sombra(8, 15, 7, 1.4);
}

/** Monitor com código na tela e um pé; fica em cima da mesa. */
export function computador() {
  const t = new Tela();
  caixa(t, 2, 2, 12, 1, 9, { luz: ACO[6], topo: ACO[5], quina: ACO[5], frente: ACO[5], sombra: ACO[3] });
  t.ret(3, 3, 9, 7, CIANO[1]);
  t.h(3, 3, 9, CIANO[2]);
  const linhas = [[4, 4, 3], [5, 5, 4], [5, 6, 2], [4, 7, 5], [5, 8, 3]];
  for (const [x, y, l] of linhas) t.h(x, y, l, CIANO[5]);
  t.p(9, 6, VERDE[6]).p(10, 8, CIANO[7]); // cursor
  t.p(12, 4, CIANO[2]).p(12, 9, VERDE[6]); // luz de ligado
  t.ret(7, 12, 2, 1, ACO[4]).ret(5, 13, 6, 1, ACO[5]);
  return t.contorno();
}

/**
 * Cama vista de lado: cabeceira à esquerda (o tripulante deita com a cabeça nela), travesseiro, cobertor e pés.
 */
export function cama() {
  const t = new Tela();
  // Estrado de madeira.
  caixa(t, 1, 8, 14, 1, 4, { luz: MADEIRA[6], topo: MADEIRA[5], quina: MADEIRA[5], frente: MADEIRA[4], sombra: MADEIRA[3] });
  // Colchão e cobertor.
  t.ret(3, 5, 11, 4, BRANCO).h(3, 5, 11, BRANCO);
  t.ret(7, 5, 7, 4, ACO[5]).h(7, 5, 7, ACO[6]).h(7, 8, 7, ACO[4]).v(7, 5, 4, ACO[7]);
  t.h(8, 6, 5, ACO[6]);
  // Travesseiro.
  t.ret(3, 5, 3, 3, '#dfe4fb').h(3, 5, 3, BRANCO).p(5, 7, ACO[7]);
  // Cabeceira, mais alta, e o pé da cama.
  t.ret(1, 2, 2, 10, MADEIRA[4]).v(1, 2, 10, MADEIRA[6]).h(1, 2, 2, MADEIRA[7]);
  t.ret(13, 5, 2, 6, MADEIRA[4]).v(13, 5, 6, MADEIRA[5]).h(13, 5, 2, MADEIRA[6]);
  pes(t, 2, 13, 13, 1, MADEIRA[2]);
  t.contorno();
  return t.sombra(8, 15, 7, 1.3);
}

export const MOVEIS = { mesa, computador, cama };

