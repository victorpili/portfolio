// Enfeites das três salas de trabalho: Pesquisa (laboratório), Criação (oficina) e Qualidade (inspeção).
// Os de 16×32 ("altos") ficam em pé encostados na parede e sobem por cima dela.
import { ACO, AMARELO, BRANCO, CIANO, CINZA, LARANJA, MADEIRA, ROSA, ROXO, TEAL, VERDE, VERMELHO } from './paleta.mjs';
import { caixa, cavalete, disco, tom } from './formas.mjs';
import { Tela, sorteio } from './tela.mjs';

const MADEIRA_CLARA = { luz: MADEIRA[7], topo: MADEIRA[6], quina: MADEIRA[7], frente: MADEIRA[4], sombra: MADEIRA[3] };
const PAPEL = '#e8e4d4';
const TINTA = ACO[4];

// ---------- Pesquisa ----------

function alerta() {
  return new Tela().mapa([
    '................',
    '.......oo.......',
    '......oWYo......',
    '......oWYo......',
    '.....oWYYYo.....',
    '.....oWYYYo.....',
    '....oWYYYYYo....',
    '....oWYooYYo....',
    '...oWYYooYYYo...',
    '...oWYYooYYYo...',
    '..oWYYYYYYYYYo..',
    '..oWYYYooYYYYo..',
    '.oWYYYYooYYYYyo.',
    '.oyyyyyyyyyyyyo.',
    '..oooooooooooo..',
    '................',
  ], { Y: AMARELO[5], y: AMARELO[3], W: AMARELO[7] });
}

/** Estante alta de madeira com livros de alturas e cores variadas. */
function estanteLivros() {
  const t = new Tela(16, 32);
  caixa(t, 1, 6, 14, 2, 23, MADEIRA_CLARA);
  t.ret(3, 9, 10, 19, MADEIRA[1]);
  const prateleiras = [[9, 15], [16, 21], [22, 28]];
  const cores = [VERMELHO[3], TEAL[5], AMARELO[4], ROXO[5], CIANO[4], VERDE[4], ROSA[4], LARANJA[4]];
  const r = sorteio(3);
  for (const [topo, base] of prateleiras) {
    t.h(3, base, 10, MADEIRA[5]);
    let x = 3;
    while (x < 12) {
      const l = r() < 0.3 ? 2 : 1;
      const a = Math.min(base - topo - 1, 3 + Math.floor(r() * 3));
      if (r() < 0.12) { x += 1; continue; }
      const cor = cores[Math.floor(r() * cores.length)];
      t.ret(x, base - a, l, a, cor).p(x, base - a, BRANCO).p(x, base - a + 1, cor);
      if (l === 2) t.v(x + 1, base - a, a, ACO[1]);
      x += l;
    }
  }
  t.v(3, 9, 19, MADEIRA[0]);
  t.contorno();
  return t.sombra(8, 31, 7, 1.2);
}

/** Quadro branco no cavalete com um gráfico de barras. */
function quadroDados() {
  const t = new Tela(16, 32);
  cavalete(t, [ACO[3], ACO[5], ACO[7]], [ACO[2], ACO[4]]);
  t.ret(2, 6, 12, 13, '#e6eaf8').h(2, 6, 12, BRANCO);
  t.h(4, 8, 6, TINTA).h(4, 10, 4, CINZA[5]);
  t.v(3, 12, 6, TINTA).h(3, 17, 10, TINTA);
  for (const [x, a, cor] of [[5, 2, TEAL[5]], [7, 4, AMARELO[4]], [9, 3, VERMELHO[4]], [11, 5, CIANO[4]]]) {
    t.ret(x, 17 - a, 1, a, cor);
  }
  t.h(5, 19, 6, ACO[4]).p(6, 19, VERMELHO[4]).p(8, 19, CIANO[4]); // bandeja com pincéis
  t.contorno();
  return t.sombra(8, 31, 7, 1.1);
}

function frasco(r) {
  return () => new Tela().mapa([
    '................',
    '......oooo......',
    '......oGgo......',
    '......oGgo......',
    '......oGgo......',
    '.....oGLLgo.....',
    '....oGLbLLgo....',
    '...oGLLLLLLgo...',
    '...oLlLLLbLLo...',
    '..oLlLLLLLLLDo..',
    '..oLLLbLLLLLDo..',
    '..oLLLLLLLLDDo..',
    '...oDDDDDDDDo...',
    '....oooooooo....',
    '................',
    '................',
  ], { G: '#d7f3fa', g: '#8fb8cc', L: r[1], l: r[2], b: r[3], D: r[0] });
}

function bolhas() {
  return new Tela().mapa([
    '................',
    '.........oo.....',
    '........oBbo....',
    '........obbo....',
    '.........oo.....',
    '.....o..........',
    '....oBo.........',
    '.....o.....o....',
    '..........oBo...',
    '...........o....',
    '......oo........',
    '.....oBbo.......',
    '.....obbo.......',
    '......oo........',
    '................',
    '................',
  ], { B: VERDE[7], b: VERDE[5] });
}

/** Globo terrestre num pé de latão. */
function globo() {
  const t = new Tela();
  const terra = (x, y) => Math.sin(x * 1.7 + y * 0.6) + Math.cos(y * 1.3 - x * 0.5) > 0.7;
  disco(t, 7.5, 6.5, 5.3, (dx, dy, d) => {
    const luz = -(dx + dy) / 6 + (1 - d / 5.3) * 0.6 - 0.2;
    return terra(dx, dy) ? tom(VERDE.slice(2, 7), luz) : tom(CIANO.slice(1, 6), luz);
  });
  for (const [x, y] of [[13, 3], [14, 5], [14, 7], [13, 9], [12, 11]]) t.p(x, y, AMARELO[4]);
  t.p(4, 3, CIANO[7]);
  t.ret(7, 12, 2, 1, AMARELO[3]).ret(5, 13, 6, 1, AMARELO[4]).h(5, 13, 2, AMARELO[6]).ret(5, 14, 6, 1, AMARELO[2]);
  t.contorno();
  return t.sombra(8, 15.2, 5, 1);
}

function pergaminho() {
  return new Tela().mapa([
    '................',
    '................',
    '................',
    '................',
    '..oooooooooooo..',
    '.oRrPPPPPPPPRro.',
    '.oRrPLLLLLPPRro.',
    '.oRrPPPPPPPPRro.',
    '.oRrPLLLLPPPRro.',
    '.oRrPPPPPPPPRro.',
    '.oRrPLLLLLLPRro.',
    '.oRrPPPPPPPPRro.',
    '..oooooooooooo..',
    '................',
    '................',
    '................',
  ], { R: '#f3e6c0', r: '#b9a27a', P: PAPEL, L: TINTA });
}

function planta() {
  const t = new Tela().mapa([
    '................',
    '.......oo.......',
    '...oo.oLLo.oo...',
    '..oLLooLlooLLo..',
    '..oLlLoLloLlLo..',
    '...oLlLLlLlLo...',
    '..oLLlLlLLlLLo..',
    '..olLLlLLlLLlo..',
    '...ollLlLlllo...',
    '....oolllloo....',
    '....oPPPPPPo....',
    '...oQPPPPPppo...',
    '....oPPPPppo....',
    '....oPPPPppo....',
    '.....oooooo.....',
    '................',
  ], { L: VERDE[6], l: VERDE[4], P: LARANJA[3], p: LARANJA[2], Q: LARANJA[4] });
  return t.sombra(8, 15, 5, 1);
}

// ---------- Criação ----------

/** Engrenagem de latão com 6 dentes (gira de 90 em 90 graus e muda de posição). */
function engrenagem() {
  const t = new Tela();
  disco(t, 8, 8, 7.2, (dx, dy, d) => {
    const ang = Math.atan2(dy, dx) + Math.PI / 6;
    const dente = Math.abs(((ang * 6) / (2 * Math.PI) + 100) % 1 - 0.5) < 0.22;
    if (d > (dente ? 7.2 : 5.4) || d < 1.9) return null;
    if (d > 3.2 && d < 4.2) return AMARELO[2];
    return tom(AMARELO.slice(3, 8), -(dx + dy) / 8);
  });
  return t.contorno();
}

function martelo() {
  return new Tela().mapa([
    '................',
    '...oooooooooo...',
    '..oMMMMMMMMMMo..',
    '..oMmmmmmmmmdo..',
    '..oddddWwddddo..',
    '...ooooWwoooo...',
    '......oWwo......',
    '......oWwo......',
    '......oWwo......',
    '......oWwo......',
    '......oWwo......',
    '......oRro......',
    '......oRro......',
    '......orro......',
    '.......oo.......',
    '................',
  ], { M: ACO[7], m: ACO[6], d: ACO[4], W: MADEIRA[6], w: MADEIRA[4], R: VERMELHO[4], r: VERMELHO[2] });
}

function serrote() {
  return new Tela().mapa([
    '................',
    '....ooooooo.....',
    '...oWWWWWWWo....',
    '...oWwoooWWo....',
    '...oWWWWWWwo....',
    '....oSSSSSSo....',
    '....oSssssSto...',
    '....oSssssSo....',
    '....oSsssSto....',
    '....oSsssSo.....',
    '....oSssSto.....',
    '....oSssSo......',
    '....oSsSto......',
    '....oSSSo.......',
    '.....ooo........',
    '................',
  ], { W: VERMELHO[4], w: VERMELHO[2], S: ACO[8], s: ACO[6], t: ACO[5] });
}

/** Bancada de madeira com morsa; duas lado a lado formam uma bancada comprida. */
function bancada() {
  const t = new Tela();
  caixa(t, 0, 6, 16, 3, 5, { luz: MADEIRA[7], topo: MADEIRA[6], quina: MADEIRA[7], frente: MADEIRA[3], sombra: MADEIRA[2] });
  t.v(15, 9, 5, MADEIRA[3]);
  t.ret(2, 10, 5, 3, MADEIRA[2]).h(2, 10, 5, MADEIRA[1]).h(4, 11, 2, ACO[6]); // gaveta
  t.ret(9, 10, 5, 3, MADEIRA[2]).h(9, 10, 5, MADEIRA[1]).h(11, 11, 2, ACO[6]);
  t.v(1, 14, 1, MADEIRA[2]).v(14, 14, 1, MADEIRA[2]);
  // Morsa de metal em cima.
  t.ret(10, 3, 4, 3, ACO[5]).h(10, 3, 4, ACO[7]).v(13, 3, 3, ACO[3]).h(8, 4, 2, ACO[6]);
  // Chave de fenda.
  t.h(3, 7, 3, AMARELO[4]).h(6, 7, 3, ACO[7]);
  return t.contorno().sombra(8, 15, 8, 0.9);
}

/** Luminária de oficina: cúpula, lâmpada acesa e haste. */
function lampada() {
  const t = new Tela().mapa([
    '................',
    '.....oooooo.....',
    '....oAAAAaao....',
    '...oAAAaaaaao...',
    '..oAAaaaaaaaao..',
    '..oooYWWWYYooo..',
    '......oYYo......',
    '.......oo.......',
    '.......mo.......',
    '.......mo.......',
    '.......mo.......',
    '.......mo.......',
    '.......mo.......',
    '....oooMmooo....',
    '...oMMMMMmmmo...',
    '....oooooooo....',
  ], { A: VERMELHO[4], a: VERMELHO[3], Y: AMARELO[6], W: AMARELO[7], m: ACO[5], M: ACO[6] });
  return t.sombra(8, 15.5, 5, 0.8);
}

/** Quadro de cortiça no cavalete, com post-its e o desenho de uma lâmpada. */
function quadroIdeias() {
  const t = new Tela(16, 32);
  cavalete(t, [MADEIRA[2], MADEIRA[4], MADEIRA[6]], [MADEIRA[2], MADEIRA[4]]);
  t.ret(2, 6, 12, 13, '#b98a55');
  const r = sorteio(9);
  for (let i = 0; i < 18; i++) t.p(2 + Math.floor(r() * 12), 6 + Math.floor(r() * 13), '#a07444');
  const notas = [[3, 7, AMARELO[6]], [8, 7, ROSA[5]], [3, 12, CIANO[5]], [10, 13, VERDE[6]]];
  for (const [x, y, cor] of notas) t.ret(x, y, 3, 3, cor).p(x + 1, y, VERMELHO[4]).h(x, y + 2, 3, ACO[5] + '55');
  // Lâmpada desenhada.
  t.mapa(['.yy.', 'yWyy', '.yy.', '.gg.'], { y: AMARELO[6], W: BRANCO, g: CINZA[5] }, 7, 12);
  t.h(5, 17, 6, ROXO[5]);
  t.contorno();
  return t.sombra(8, 31, 7, 1.1);
}

function barril() {
  const t = new Tela().mapa([
    '................',
    '................',
    '.....oooooo.....',
    '....oTTTTTTo....',
    '...oTttttttTo...',
    '...oKTTTTTTKo...',
    '...oWWWWWWwwo...',
    '..oWWwWWWwWwwo..',
    '..oBBBBBBBBbbo..',
    '..oWWwWWWwWwwo..',
    '..oWWwWWWwWwwo..',
    '..oBBBBBBBBbbo..',
    '...oWwWWWwWwo...',
    '....owwwwwwo....',
    '.....oooooo.....',
    '................',
  ], { T: MADEIRA[6], t: MADEIRA[5], K: MADEIRA[4], W: MADEIRA[5], w: MADEIRA[3], B: ACO[6], b: ACO[4] });
  return t.sombra(8, 15, 5.5, 1);
}

function lapis() {
  const t = new Tela();
  t.v(5, 3, 6, AMARELO[5]).p(5, 2, ROSA[5]).v(6, 3, 6, AMARELO[3]);
  t.v(8, 4, 5, VERMELHO[4]).p(8, 3, PAPEL);
  t.v(10, 2, 7, CIANO[5]).v(11, 2, 7, CIANO[3]);
  caixa(t, 4, 8, 8, 1, 6, { luz: ACO[7], topo: ACO[3], quina: ACO[3], frente: ACO[6], sombra: ACO[4] });
  t.v(5, 9, 5, ACO[7]);
  return t.contorno();
}

function papeis() {
  const t = new Tela();
  caixa(t, 2, 9, 11, 3, 2, { luz: BRANCO, topo: PAPEL, quina: BRANCO, frente: CINZA[5], sombra: CINZA[4] });
  t.h(4, 10, 6, CINZA[5]);
  // Planta da nave enrolada.
  t.ret(3, 6, 11, 3, CIANO[3]).h(3, 6, 11, CIANO[4]).h(3, 8, 11, CIANO[2]);
  t.ret(13, 6, 1, 3, CIANO[5]).p(13, 7, BRANCO);
  return t.contorno();
}

/** Caixote de madeira com reforço em X. */
function caixote() {
  const t = new Tela();
  caixa(t, 2, 4, 12, 3, 8, MADEIRA_CLARA);
  for (let i = 0; i <= 8; i++) {
    const y = 8 + Math.round((i * 5) / 8);
    t.p(3 + i, y, MADEIRA[6]).p(12 - i, y, MADEIRA[6]).p(3 + i, y + 1, MADEIRA[3]).p(12 - i, y + 1, MADEIRA[3]);
  }
  t.h(2, 7, 12, MADEIRA[5]).v(2, 7, 8, MADEIRA[5]).v(13, 7, 8, MADEIRA[2]).h(2, 14, 12, MADEIRA[2]);
  t.h(4, 5, 8, MADEIRA[5]);
  return t.contorno().sombra(8, 15.4, 7, 0.9);
}

// ---------- Qualidade ----------

function escudo() {
  return new Tela().mapa([
    '................',
    '..oooooooooooo..',
    '..oFFFFFFFFFfo..',
    '..oFGGGGGGGGfo..',
    '..oFGGGGGGGWfo..',
    '..oFGGGGGGWWfo..',
    '..oFGWGGGWWgfo..',
    '..oFGWWGWWggfo..',
    '...oFGWWWggfo...',
    '...oFGgWgggfo...',
    '....oFgggfo.....',
    '.....oFgfo......',
    '......ofo.......',
    '.......o........',
    '................',
    '................',
  ], { F: ACO[8], f: ACO[5], G: VERDE[5], g: VERDE[3], W: BRANCO });
}

/** Arquivo de aço com gavetas e etiquetas; `gavetas` define a altura. */
function arquivo(gavetas) {
  return () => {
    const altura = gavetas * 5;
    const t = new Tela(16, gavetas > 2 ? 32 : 16);
    const base = t.a - 2;
    const topo = base - altura - 2;
    caixa(t, 2, topo, 12, 2, altura, { luz: ROXO[8], topo: ROXO[7], quina: ROXO[8], frente: ROXO[5], sombra: ROXO[4] });
    for (let g = 0; g < gavetas; g++) {
      const y = topo + 2 + g * 5;
      t.h(3, y + 4, 10, ROXO[3]);
      t.ret(6, y + 1, 4, 2, PAPEL).h(6, y + 1, 4, BRANCO);
      t.h(7, y + 3, 2, ROXO[2]);
    }
    t.contorno();
    return t.sombra(8, t.a - 0.5, 6.5, 1);
  };
}

/** Quadro com a lista de conferência: certos em verde, um errado em vermelho. */
function quadroQualidade() {
  const t = new Tela(16, 32);
  cavalete(t, [ROXO[2], ROXO[4], ROXO[6]], [ACO[2], ACO[4]]);
  t.ret(2, 6, 12, 13, '#e6eaf8').h(2, 6, 12, BRANCO);
  const itens = [[8, VERDE[4]], [11, VERDE[4]], [14, VERMELHO[4]], [17, VERDE[4]]];
  for (const [y, cor] of itens) {
    t.p(3, y, cor).p(4, y + 1, cor).p(5, y, cor).p(6, y - 1, cor);
    t.h(8, y, 5, TINTA);
  }
  t.contorno();
  return t.sombra(8, 31, 7, 1.1);
}

function trofeu() {
  return new Tela().mapa([
    '................',
    '....oooooooo....',
    '..ooYWYYYYyyoo..',
    '.oYoYWYYYYyyoyo.',
    '.oYoYWYYYYyyoyo.',
    '..ooYYYYYYyyoo..',
    '....oYYYYyyo....',
    '.....oYYyyo.....',
    '......oYyo......',
    '......oYyo......',
    '.....oYYyyo.....',
    '....oDDDDDDo....',
    '....oDdddddo....',
    '....oooooooo....',
    '................',
    '................',
  ], { Y: AMARELO[5], y: AMARELO[3], W: AMARELO[7], D: MADEIRA[4], d: MADEIRA[2] });
}

function checklist() {
  return new Tela().mapa([
    '................',
    '.....oooooo.....',
    '...ooCCCCCCoo...',
    '..oBBBCCCCBBBo..',
    '..oBPPPPPPPPBo..',
    '..oBPgPLLLLPBo..',
    '..oBPPPPPPPPBo..',
    '..oBPgPLLLPPBo..',
    '..oBPPPPPPPPBo..',
    '..oBPrPLLLLPBo..',
    '..oBPPPPPPPPBo..',
    '..oBBBBBBBBBBo..',
    '...oooooooooo...',
    '................',
    '................',
    '................',
  ], { C: ACO[6], B: MADEIRA[4], P: PAPEL, L: CINZA[4], g: VERDE[4], r: VERMELHO[4] });
}

function ampulheta() {
  return new Tela().mapa([
    '................',
    '...oooooooooo...',
    '...oWWWWWWWwo...',
    '....oGSSSSGo....',
    '....oGSSSSGo....',
    '.....oGSSGo.....',
    '......oGSo......',
    '......oGSo......',
    '.....oGGSGo.....',
    '....oGGGSGGo....',
    '....oGSSSSGo....',
    '...oWWWWWWWwo...',
    '...oooooooooo...',
    '................',
    '................',
    '................',
  ], { W: MADEIRA[5], w: MADEIRA[3], G: '#cfe9f2', S: AMARELO[5] });
}

/** Caixa de rejeitados: vermelha, com um X e papéis amassados em cima. */
function rejeitado() {
  const t = new Tela();
  caixa(t, 2, 5, 12, 2, 8, { luz: VERMELHO[5], topo: VERMELHO[1], quina: VERMELHO[4], frente: VERMELHO[3], sombra: VERMELHO[2] });
  t.p(5, 4, PAPEL).p(6, 4, BRANCO).p(6, 5, PAPEL).p(9, 5, PAPEL).p(10, 4, CINZA[6]);
  for (let i = 0; i < 5; i++) t.p(6 + i, 8 + i, BRANCO).p(10 - i, 8 + i, BRANCO);
  return t.contorno().sombra(8, 15.3, 6.5, 0.9);
}

export const ENFEITES_TRABALHO = {
  alerta,
  'estante-livros': estanteLivros,
  'quadro-dados': quadroDados,
  'frasco-verde': frasco([VERDE[2], VERDE[5], VERDE[7], VERDE[7]]),
  'frasco-azul': frasco([CIANO[2], CIANO[4], CIANO[6], CIANO[7]]),
  'frasco-amarelo': frasco([AMARELO[2], AMARELO[5], AMARELO[7], AMARELO[7]]),
  bolhas,
  globo,
  pergaminho,
  planta,
  engrenagem,
  martelo,
  serrote,
  bancada,
  lampada,
  'quadro-ideias': quadroIdeias,
  barril,
  lapis,
  papeis,
  caixote,
  escudo,
  'arquivo-alto': arquivo(5),
  arquivo: arquivo(2),
  'quadro-qualidade': quadroQualidade,
  trofeu,
  checklist,
  ampulheta,
  rejeitado,
};
