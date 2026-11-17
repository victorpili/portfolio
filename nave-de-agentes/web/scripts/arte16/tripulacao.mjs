// A tripulação, 16×16, de frente. A Capitã e o Imediato são código (robôs); os três agentes do Claude são gente.
// A luz vem de cima e da esquerda: claro à esquerda, escuro à direita.
import { ACO, AMARELO, CIANO, CINZA, LARANJA, LAVANDA, MADEIRA, PELE, ROSA, BRANCO } from './paleta.mjs';
import { Tela } from './tela.mjs';

/** Corpo comum: ombros, mangas, mãos (s), pernas (p/P) e botas (b/B). y = insígnia. */
const CORPO = [
  '...oUuuwwuudo...',
  '..oUUuuuuuuddo..',
  '..osUuuyuuudso..',
  '...oopPoopPoo...',
  '....obBoobBo....',
  '.....oo..oo.....',
];

/** Cabeça de gente: cabelo (H claro, h escuro, k brilho), pele (s, S sombra), olhos (e), bochecha (r), boca (m). */
const CABECA = [
  '................',
  '.....oooooo.....',
  '....oHHHHHHo....',
  '...oHkkHHHHho...',
  '...oHkHHsssho...',
  '...oHsssssSho...',
  '...oHesssseSo...',
  '...osesssseSo...',
  '...orssmmsrSo...',
  '....oSssssSo....',
];

/** Cabeça de robô: chapa (M claro, n meio, D escuro), visor (V) e olhos acesos (E). */
const CABECA_ROBO = [
  '................',
  '................',
  '...oooooooooo...',
  '...oMMMMMMMnDo..',
  '...oMVVVVVVDDo..',
  '...oMVEVVEVDDo..',
  '...oMVEVVEVDDo..',
  '...oMVVVVVVDDo..',
  '...onnnnnnnDDo..',
  '....oDDDDDDoo...',
];

const PELE_CLARA = { s: PELE[5], S: PELE[4], r: '#f0a58a', m: '#d07a6a', e: ACO[0] };
const METAL = { M: CINZA[6], n: CINZA[5], d: CINZA[3], D: CINZA[4], V: ACO[0], s: CINZA[5] };

/** Monta cabeça + corpo e aplica retoques (linhas inteiras por índice). */
function montar(cabeca, legenda, retoques = {}) {
  const linhas = [...cabeca, ...CORPO];
  for (const [i, linha] of Object.entries(retoques)) linhas[+i] = linha;
  for (const [i, l] of linhas.entries()) if (l.length !== 16) throw new Error(`linha ${i} com ${l.length} colunas`);
  return new Tela().mapa(linhas, legenda);
}

/** Uniforme e botas na rampa da cor do tripulante. */
const uniforme = (r, insignia) => ({
  U: r[5], u: r[4], d: r[3], w: BRANCO, y: insignia, p: ACO[3], P: ACO[2], b: ACO[1], B: ACO[3],
});

export const TRIPULACAO = {
  // Capitã: robô de quepe azul-marinho com a âncora dourada, olhos e uniforme amarelos.
  capita: () => montar(CABECA_ROBO, { ...METAL, ...uniforme(AMARELO.slice(1), ACO[1]), E: AMARELO[6], N: ACO[5], K: ACO[6], G: AMARELO[5] }, {
    0: '....oooooooo....',
    1: '...oKNNGGNNNo...',
    2: '..oKNNNNNNNNNo..',
    3: '..oooooooooooo..',
  }),

  // Imediato: robô com antena acesa e olhos ciano; confere o trabalho.
  imediato: () => montar(CABECA_ROBO, { ...METAL, ...uniforme(CIANO.slice(1), ACO[1]), E: CIANO[6], L: CIANO[7] }, {
    0: '........oLo.....',
    1: '.........o......',
  }),

  // Pesquisador: óculos de laboratório na testa e jaleco laranja.
  pesquisador: () => montar(CABECA, { ...PELE_CLARA, ...uniforme(LARANJA, CIANO[6]), H: MADEIRA[4], h: MADEIRA[2], k: MADEIRA[6], g: ACO[1], C: CIANO[5] }, {
    3: '...ogCCggCCgo...',
  }),

  // Redatora de boina rosa e cabelo comprido.
  redator: () => montar(CABECA, { ...PELE_CLARA, ...uniforme(ROSA, AMARELO[6]), H: ACO[3], h: ACO[1], k: ACO[5], R: ROSA[5], q: ROSA[3] }, {
    0: '.....ooooooo....',
    1: '....oRRRRRRqo...',
    2: '...oRRRRRRqqqo..',
    3: '...oHkkHHHHhho..',
    9: '...ohSssssShho..',
  }),

  // Revisor: cabelo grisalho, óculos e uniforme lavanda.
  revisor: () => montar(CABECA, { ...PELE_CLARA, ...uniforme(LAVANDA, AMARELO[6]), H: CINZA[6], h: CINZA[4], k: CINZA[7], G: ACO[2], L: '#dfe6ff' }, {
    6: '...oGeLGGLeGo...',
  }),
};
