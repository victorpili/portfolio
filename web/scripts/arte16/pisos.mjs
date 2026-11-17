// Pisos e paredes (16×16, repetem lado a lado). Cada sala tem o seu material.
import { ACO, AMARELO, CIANO, MADEIRA, ROXO, TEAL, VERDE } from './paleta.mjs';
import { Tela, sorteio } from './tela.mjs';

/** Placa com bisel: luz em cima e à esquerda, sombra embaixo e à direita. */
function placa(t, x, y, l, a, [escuro, base, claro]) {
  t.ret(x, y, l, a, base);
  t.h(x, y, l, claro).v(x, y, a, claro);
  t.h(x, y + a - 1, l, escuro).v(x + l - 1, y, a, escuro);
  return t;
}

/** Rebite: um ponto claro com sombra embaixo e à direita. */
function rebite(t, x, y, claro, escuro) {
  return t.p(x, y, claro).p(x + 1, y + 1, escuro);
}

/** Pontos soltos de ruído, para o material não parecer chapado. */
function ruido(t, semente, n, cores, area = [0, 0, 16, 16]) {
  const r = sorteio(semente);
  const [x0, y0, l, a] = area;
  for (let i = 0; i < n; i++) t.p(x0 + Math.floor(r() * l), y0 + Math.floor(r() * a), cores[Math.floor(r() * cores.length)]);
  return t;
}

/** Aço da nave: uma chapa por tile, com rebites nos cantos. Fundo da Ponte e de salas sem material próprio. */
function piso() {
  const t = placa(new Tela(), 0, 0, 16, 16, [ACO[1], ACO[2], ACO[3]]);
  ruido(t, 7, 10, [ACO[1], ACO[3]], [2, 2, 12, 12]);
  for (const [x, y] of [[2, 2], [12, 2], [2, 12], [12, 12]]) rebite(t, x, y, ACO[4], ACO[1]);
  return t;
}

/** Ponte: chapas escuras de 8×8 com um filete de luz ciano. */
function pisoPonte() {
  const t = placa(new Tela(), 0, 0, 16, 16, [ACO[0], ACO[1], '#181c38']);
  ruido(t, 11, 8, [ACO[2], ACO[0]], [2, 2, 12, 12]);
  t.h(5, 8, 6, ACO[0]).h(5, 9, 6, ACO[2]);
  t.p(7, 8, CIANO[2]).p(8, 8, CIANO[3]);
  for (const [x, y] of [[2, 2], [12, 2], [2, 12], [12, 12]]) rebite(t, x, y, ACO[3], ACO[0]);
  return t;
}

/** Corredor: grade de metal, ripas com fresta escura. */
function pisoCorredor() {
  const t = new Tela().ret(0, 0, 16, 16, ACO[0]);
  for (let y = 0; y < 16; y += 4) {
    t.h(0, y, 16, ACO[3]).h(0, y + 1, 16, ACO[2]).h(0, y + 2, 16, ACO[1]);
  }
  t.v(0, 0, 16, ACO[1]).v(15, 0, 16, ACO[0]);
  for (let y = 0; y < 16; y += 4) t.p(4, y, ACO[4]).p(11, y, ACO[4]);
  return t;
}

/** Laboratório: ladrilhos claros de 8×8, alternando o tom, com rejunte. */
function pisoPesquisa() {
  const t = new Tela();
  [[0, 0], [8, 0], [0, 8], [8, 8]].forEach(([x, y], i) => {
    const par = (x + y) % 16 === 0;
    placa(t, x, y, 8, 8, [TEAL[1], par ? '#1c4648' : TEAL[2], par ? TEAL[3] : '#1c4648']);
    t.p(x + 1, y + 1, par ? TEAL[4] : TEAL[3]);
    t.p(x + 5, y + 5, par ? TEAL[2] : TEAL[1]);
  });
  return t;
}

/** Oficina: tábuas de madeira na horizontal, com emendas desencontradas e veios. */
function pisoCriacao() {
  const t = new Tela();
  const emendas = [5, 13, 1, 9];
  for (let i = 0; i < 4; i++) {
    const y = i * 4;
    t.ret(0, y, 16, 4, i % 2 ? '#3e2316' : MADEIRA[2]);
    t.h(0, y, 16, '#55311f');
    t.h(0, y + 3, 16, MADEIRA[1]);
    const e = emendas[i];
    t.v(e, y, 3, MADEIRA[1]).v(e + 1, y + 1, 2, '#55311f');
    const r = sorteio(40 + i);
    for (let k = 0; k < 3; k++) {
      const gx = Math.floor(r() * 12);
      t.h(gx, y + 1 + Math.floor(r() * 2), 2 + Math.floor(r() * 3), '#35200f');
    }
  }
  return t;
}

/** Qualidade: piso xadrez em losango, como uma sala de inspeção. */
function pisoQualidade() {
  const t = new Tela();
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.abs(((x + 8) % 16) - 7.5) + Math.abs(((y + 8) % 16) - 7.5);
      t.p(x, y, d < 8 ? '#2f2655' : ROXO[2]);
      if (Math.abs(d - 8) < 0.6) t.p(x, y, ROXO[1]);
    }
  }
  // Luz no topo dos losangos.
  t.p(7, 1, ROXO[3]).p(8, 1, ROXO[3]).p(15, 9, ROXO[3]).p(0, 9, ROXO[3]);
  return t;
}

/** Dormitório: carpete azul com um padrão miúdo. */
function pisoDormitorio() {
  const t = new Tela().ret(0, 0, 16, 16, ACO[2]);
  for (let y = 0; y < 16; y += 2) for (let x = (y / 2) % 2; x < 16; x += 2) t.p(x, y, '#222849');
  for (const [cx, cy] of [[4, 4], [12, 12]]) {
    t.p(cx, cy - 1, ACO[3]).p(cx - 1, cy, ACO[3]).p(cx + 1, cy, ACO[3]).p(cx, cy + 1, ACO[3]).p(cx, cy, ACO[4]);
  }
  return t;
}

/**
 * Parede do fundo, vista de frente: o topo (a espessura da parede, mais claro), o painel embutido,
 * um friso de cor e o rodapé escuro.
 */
function parede({ topo, painel, friso }) {
  const [e0, e1, e2, e3, e4] = painel;
  const t = new Tela();
  t.h(0, 0, 16, topo[1]).h(0, 1, 16, topo[0]).h(0, 2, 16, e0);
  t.ret(0, 3, 16, 9, e2);
  // Painel embutido: sombra em cima e à esquerda, luz embaixo e à direita.
  t.ret(2, 4, 12, 6, e1);
  t.h(2, 4, 12, e0).v(2, 4, 6, e0);
  t.h(3, 10, 11, e3).v(14, 5, 6, e3);
  t.ret(3, 5, 11, 5, e1);
  t.h(4, 6, 9, e2).h(4, 8, 9, e2);
  t.h(0, 3, 16, e3);
  t.h(0, 11, 16, friso[0]).h(0, 12, 16, friso[1]);
  t.ret(0, 13, 16, 3, e0).h(0, 13, 16, e1);
  t.p(0, 5, e4).p(15, 5, e1);
  return t;
}

/** Casco da nave por fora: chapas com bisel e rebites. */
function casco() {
  const t = placa(new Tela(), 0, 0, 16, 16, [ACO[3], ACO[4], ACO[5]]);
  placa(t, 0, 8, 16, 8, [ACO[3], '#4a5387', ACO[5]]);
  for (const [x, y] of [[2, 2], [13, 2], [2, 10], [13, 10]]) rebite(t, x, y, ACO[6], ACO[3]);
  return ruido(t, 77, 6, [ACO[5], '#434b80'], [1, 1, 14, 14]);
}

export const PISOS = {
  casco,
  piso,
  'piso-ponte': pisoPonte,
  'piso-corredor': pisoCorredor,
  'piso-pesquisa': pisoPesquisa,
  'piso-criacao': pisoCriacao,
  'piso-qualidade': pisoQualidade,
  'piso-dormitorio': pisoDormitorio,
  parede: () => parede({ topo: [ACO[5], ACO[6]], painel: [ACO[1], ACO[2], ACO[3], ACO[4], ACO[5]], friso: [AMARELO[3], AMARELO[1]] }),
  'parede-pesquisa': () => {
    const t = parede({ topo: [TEAL[5], TEAL[6]], painel: [TEAL[1], TEAL[2], TEAL[3], TEAL[4], TEAL[5]], friso: [VERDE[5], VERDE[2]] });
    // Cano que atravessa a parede.
    return t.h(0, 7, 16, ACO[5]).h(0, 8, 16, ACO[3]).p(7, 7, ACO[7]).p(7, 8, ACO[4]).v(8, 6, 4, ACO[2]);
  },
  'parede-criacao': () => {
    const t = new Tela();
    t.h(0, 0, 16, MADEIRA[6]).h(0, 1, 16, MADEIRA[5]).h(0, 2, 16, MADEIRA[1]);
    for (let x = 0; x < 16; x += 4) {
      t.ret(x, 3, 4, 8, x % 8 ? MADEIRA[3] : MADEIRA[4]).v(x, 3, 8, MADEIRA[5]).v(x + 3, 3, 8, MADEIRA[2]);
    }
    ruido(t, 61, 6, [MADEIRA[2], MADEIRA[5]], [0, 4, 16, 6]);
    t.h(0, 11, 16, ACO[5]).h(0, 12, 16, ACO[3]).p(3, 11, ACO[7]).p(11, 11, ACO[7]);
    return t.ret(0, 13, 16, 3, MADEIRA[0]).h(0, 13, 16, MADEIRA[2]);
  },
  'parede-qualidade': () => parede({ topo: [ROXO[5], ROXO[6]], painel: [ROXO[1], ROXO[2], ROXO[3], ROXO[4], ROXO[5]], friso: [VERDE[5], VERDE[3]] }),
};
