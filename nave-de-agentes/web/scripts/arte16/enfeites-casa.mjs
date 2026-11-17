// Enfeites do Dormitório (quarto) e da Ponte (comando).
import { ACO, AMARELO, BRANCO, CIANO, CINZA, LARANJA, MADEIRA, ROSA, ROXO, TEAL, VERDE, VERMELHO } from './paleta.mjs';
import { caixa, disco, tom } from './formas.mjs';
import { Tela, sorteio } from './tela.mjs';

const MADEIRA_CLARA = { luz: MADEIRA[7], topo: MADEIRA[6], quina: MADEIRA[7], frente: MADEIRA[4], sombra: MADEIRA[3] };
const MADEIRA_ESCURA = { luz: MADEIRA[6], topo: MADEIRA[5], quina: MADEIRA[6], frente: MADEIRA[3], sombra: MADEIRA[2] };

// ---------- Dormitório ----------

/** Quadro na parede: um planeta e estrelas, numa moldura dourada. */
function quadroParede() {
  const t = new Tela();
  t.ret(1, 2, 14, 12, AMARELO[4]).h(1, 2, 14, AMARELO[6]).v(1, 2, 12, AMARELO[6]).h(1, 13, 14, AMARELO[2]).v(14, 2, 12, AMARELO[2]);
  t.ret(3, 4, 10, 8, ROXO[1]);
  t.ret(3, 9, 10, 3, ROXO[2]);
  disco(t, 9.5, 7, 2.6, (dx, dy) => tom(ROSA.slice(2, 7), -(dx + dy) / 3));
  t.h(6, 7, 7, LARANJA[5]);
  for (const [x, y] of [[4, 5], [6, 4], [12, 5], [5, 8]]) t.p(x, y, BRANCO);
  t.h(3, 11, 4, TEAL[3]).h(4, 10, 2, TEAL[4]);
  return t.contorno();
}

function relogio() {
  const t = new Tela();
  disco(t, 8, 8, 6.4, (dx, dy, d) => (d > 5.2 ? tom(MADEIRA.slice(3, 8), -(dx + dy) / 6) : d > 4.6 ? MADEIRA[2] : '#eef0f5'));
  for (const [x, y] of [[7, 4], [8, 4], [11, 7], [11, 8], [7, 11], [8, 11], [4, 7], [4, 8]]) t.p(x, y, ACO[3]);
  t.v(8, 5, 3, ACO[1]).h(8, 8, 3, ACO[1]).p(8, 8, VERMELHO[4]);
  return t.contorno();
}

/** Armário alto de duas portas, com cornija e puxadores dourados. */
function armario() {
  const t = new Tela(16, 32);
  caixa(t, 1, 5, 14, 2, 24, MADEIRA_ESCURA);
  t.h(1, 7, 14, MADEIRA[5]);
  for (const x of [2, 8]) {
    t.ret(x, 9, 5, 17, MADEIRA[3]).h(x, 9, 5, MADEIRA[2]).v(x, 9, 17, MADEIRA[2]);
    t.ret(x + 1, 11, 3, 6, MADEIRA[4]).ret(x + 1, 19, 3, 5, MADEIRA[4]);
  }
  t.v(7, 15, 2, AMARELO[5]).v(8, 15, 2, AMARELO[3]);
  t.h(2, 27, 12, MADEIRA[2]);
  t.contorno();
  return t.sombra(8, 31, 7, 1.1);
}

/** TV de tubo num rack baixo, com um joguinho na tela. */
function tv() {
  const t = new Tela();
  caixa(t, 2, 11, 12, 1, 3, MADEIRA_ESCURA);
  caixa(t, 2, 2, 12, 1, 9, { luz: CINZA[5], topo: CINZA[4], quina: CINZA[4], frente: CINZA[3], sombra: CINZA[2] });
  t.ret(3, 3, 8, 6, ACO[1]);
  t.ret(3, 6, 8, 3, VERDE[3]).h(3, 6, 8, VERDE[5]);
  t.ret(5, 4, 1, 2, AMARELO[6]).p(9, 5, VERMELHO[4]).p(8, 3, BRANCO).p(4, 3, BRANCO);
  t.p(12, 4, VERMELHO[4]).p(12, 6, CINZA[6]).p(12, 7, CINZA[6]);
  t.p(5, 1, CINZA[5]).p(4, 0, CINZA[5]).p(10, 1, CINZA[5]).p(11, 0, CINZA[5]);
  t.contorno();
  return t.sombra(8, 15.3, 7, 0.9);
}

function controle() {
  const t = new Tela().mapa([
    '................',
    '................',
    '................',
    '................',
    '................',
    '...oooooooooo...',
    '..oGGGGGGGGGgo..',
    '.oGGdGGGGGGRGgo.',
    '.oGdddGGGGGGGgo.',
    '.oGGdGGGGRGGGgo.',
    '.ogGGGgggGGGggo.',
    '..oggo...oggo...',
    '...oo.....oo....',
    '................',
    '................',
    '................',
  ], { G: CINZA[6], g: CINZA[4], d: ACO[1], R: VERMELHO[4] });
  return t.sombra(8, 12.5, 7, 1);
}

/** Abajur de pé, cúpula de tecido acesa. */
function abajur() {
  const t = new Tela().mapa([
    '................',
    '................',
    '.....oooooo.....',
    '....oWWWWYYo....',
    '....oWWYYYYo....',
    '...oWYYYYYyyo...',
    '...oWYYYYYyyo...',
    '..ooyyyyyyyyoo..',
    '.......mo.......',
    '.......mo.......',
    '.......mo.......',
    '.......mo.......',
    '.......mo.......',
    '.....oommoo.....',
    '....oMMMMmmo....',
    '.....oooooo.....',
  ], { W: AMARELO[7], Y: AMARELO[6], y: AMARELO[4], m: MADEIRA[4], M: MADEIRA[5] });
  return t.sombra(8, 15.5, 4.5, 0.8);
}

/** Criado-mudo com gaveta, um livro e um despertador em cima. */
function criadoMudo() {
  const t = new Tela();
  caixa(t, 2, 7, 12, 3, 5, MADEIRA_CLARA);
  t.ret(4, 11, 8, 3, MADEIRA[3]).h(4, 11, 8, MADEIRA[2]).h(7, 12, 2, AMARELO[5]);
  t.ret(3, 6, 5, 2, ROXO[5]).h(3, 6, 5, ROXO[6]).h(3, 7, 5, BRANCO);
  disco(t, 10.5, 5.5, 2.2, (dx, dy, d) => (d > 1.4 ? VERMELHO[4] : BRANCO));
  t.p(10, 5, ACO[1]);
  t.v(3, 14, 1, MADEIRA[3]).v(12, 14, 1, MADEIRA[3]);
  return t.contorno().sombra(8, 15.4, 6.5, 0.8);
}

// ---------- Ponte ----------

/**
 * Console da Ponte: base de aço e painel inclinado. `painel(t)` desenha o miolo do painel (x 3..12, y 4..8).
 * A luz verde da base pisca junto com o enfeite.
 */
function console(painel) {
  return () => {
    const t = new Tela();
    caixa(t, 1, 9, 14, 2, 5, { luz: ACO[7], topo: ACO[6], quina: ACO[7], frente: ACO[4], sombra: ACO[3] });
    t.h(3, 12, 10, ACO[3]).p(4, 12, VERDE[6]).p(6, 12, AMARELO[5]);
    t.ret(2, 3, 12, 7, ACO[3]).h(2, 3, 12, ACO[5]).v(2, 3, 7, ACO[4]);
    t.ret(3, 4, 10, 5, ACO[0]);
    painel(t);
    t.contorno();
    return t.sombra(8, 15.4, 7, 0.8);
  };
}

const consoleTela = console((t) => {
  t.ret(3, 4, 10, 5, CIANO[1]);
  const onda = [6, 5, 5, 6, 7, 7, 6, 5, 6, 7];
  onda.forEach((y, i) => t.p(3 + i, y, CIANO[6]));
  t.p(4, 4, CIANO[3]).p(5, 4, CIANO[3]);
});

const consoleGrade = console((t) => {
  t.ret(3, 4, 10, 5, VERDE[1]);
  for (let x = 4; x < 13; x += 3) t.v(x, 4, 5, VERDE[2]);
  t.h(3, 6, 10, VERDE[2]);
  t.p(9, 5, VERDE[7]).p(6, 7, AMARELO[6]).p(11, 7, VERDE[6]);
});

const consoleBotoes = console((t) => {
  const cores = [VERMELHO[4], AMARELO[5], VERDE[5], CIANO[5], VERDE[5], VERMELHO[4], CIANO[5], AMARELO[5]];
  const r = sorteio(5);
  for (let y = 4; y <= 8; y += 2) {
    for (let x = 3; x <= 12; x += 2) t.p(x, y, cores[Math.floor(r() * cores.length)]).p(x + 1, y, ACO[2]);
  }
});

const consolePainel = console((t) => {
  t.ret(3, 4, 10, 5, ACO[2]);
  disco(t, 5.5, 6.5, 2.2, (dx, dy, d) => (d > 1.6 ? CINZA[5] : BRANCO));
  t.p(6, 5, VERMELHO[4]).p(5, 6, VERMELHO[4]);
  for (const [x, y] of [[9, 5], [11, 7]]) t.v(x, 4, 5, ACO[1]).ret(x - 1 + 1, y, 1, 1, AMARELO[5]);
  t.p(12, 4, VERDE[6]);
});

/** Radar: tela redonda com a varredura e dois pontos, num pedestal. */
function radar() {
  const t = new Tela();
  caixa(t, 3, 11, 10, 1, 3, { luz: ACO[7], topo: ACO[6], quina: ACO[6], frente: ACO[4], sombra: ACO[3] });
  disco(t, 8, 6.5, 5.6, (dx, dy, d) => {
    if (d > 4.7) return tom(ACO.slice(3, 8), -(dx + dy) / 6);
    const ang = Math.atan2(dy, dx);
    if (ang > -1.2 && ang < -0.5) return VERDE[4];
    if (Math.abs(d - 2.6) < 0.45) return VERDE[3];
    return VERDE[1];
  });
  t.h(4, 6, 8, VERDE[2]).v(8, 2, 9, VERDE[2]);
  t.p(10, 4, VERDE[7]).p(6, 8, VERDE[6]).p(8, 6, VERDE[6]);
  t.contorno();
  return t.sombra(8, 15.4, 5.5, 0.8);
}

export const ENFEITES_CASA = {
  'quadro-parede': quadroParede,
  relogio,
  armario,
  tv,
  controle,
  abajur,
  'criado-mudo': criadoMudo,
  'console-tela': consoleTela,
  'console-grade': consoleGrade,
  'console-botoes': consoleBotoes,
  'console-painel': consolePainel,
  radar,
};
