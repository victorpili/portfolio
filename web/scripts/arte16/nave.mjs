// Por fora da nave: as chapas do casco e os motores (bocal e chama, em 2 quadros).
import { ACO, AMARELO, LARANJA, VERMELHO } from './paleta.mjs';
import { placa, rebite, ruido } from './pisos.mjs';
import { Tela, sorteio } from './tela.mjs';

/** Chapas do casco com bisel e rebites; repete lado a lado. */
function casco() {
  const t = placa(new Tela(), 0, 0, 16, 16, [ACO[3], ACO[4], ACO[5]]);
  placa(t, 0, 8, 16, 8, [ACO[3], '#4a5387', ACO[5]]);
  for (const [x, y] of [[2, 2], [13, 2], [2, 10], [13, 10]]) rebite(t, x, y, ACO[6], ACO[3]);
  return ruido(t, 77, 6, [ACO[5], '#434b80'], [1, 1, 14, 14]);
}

/**
 * Motor visto de lado, apontando para trás (esquerda): bocal de metal colado no casco (à direita) e a chama.
 * `comprimento` e `semente` mudam a chama entre os quadros.
 */
function motor(comprimento, semente) {
  return () => {
    const t = new Tela(32, 16);
    const r = sorteio(semente);
    // Bocal: abre para a esquerda, metal com luz em cima e brasa por dentro.
    for (let x = 20; x < 32; x++) {
      const k = (x - 20) / 11;
      const meia = 6.5 - 2.5 * k;
      for (let y = 0; y < 16; y++) {
        const dy = y + 0.5 - 8;
        if (Math.abs(dy) > meia) continue;
        const borda = Math.abs(dy) > meia - 1;
        t.p(x, y, borda ? (dy < 0 ? ACO[7] : ACO[3]) : dy < -2 ? ACO[6] : dy < 2 ? ACO[5] : ACO[4]);
      }
    }
    t.v(20, 2, 12, ACO[2]).v(21, 3, 10, LARANJA[3]).v(22, 4, 8, ACO[3]);
    t.v(26, 4, 8, ACO[3]).v(27, 4, 8, ACO[6]);
    t.contorno();
    // A chama vem depois do contorno: fogo não tem borda.
    // Chama: mais larga junto do bocal, afinando para a ponta; miolo claro, borda vermelha.
    for (let x = 19; x >= 19 - comprimento; x--) {
      const k = (x - (19 - comprimento)) / comprimento; // 0 na ponta, 1 no bocal
      const meia = 0.8 + 4.6 * Math.pow(k, 0.7) + (r() - 0.5) * 0.9;
      for (let y = 0; y < 16; y++) {
        const dy = Math.abs(y + 0.5 - 8);
        if (dy > meia) continue;
        const f = dy / meia;
        const cor = f < 0.35 && k > 0.35 ? '#fff4c8' : f < 0.6 ? AMARELO[5] : f < 0.85 ? LARANJA[5] : VERMELHO[4];
        t.p(x, y, cor);
      }
    }
    return t;
  };
}

export const NAVE = { casco, 'motor-1': motor(19, 1), 'motor-2': motor(15, 2) };
