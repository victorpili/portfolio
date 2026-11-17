// Uma tela de pixels para desenhar os sprites: pixels, retângulos, mapas de caracteres, contorno e sombra.
import { codificarPng } from './png.mjs';
import { CONTORNO, SOMBRA } from './paleta.mjs';

/** '#rgb', '#rrggbb' ou '#rrggbbaa' para [r, g, b, a]. */
export function rgba(cor) {
  let h = cor.slice(1);
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = (i) => parseInt(h.slice(i, i + 2), 16);
  return [n(0), n(2), n(4), h.length === 8 ? n(6) : 255];
}

/** Gerador pseudoaleatório com semente (mulberry32): o mesmo desenho a cada execução. */
export function sorteio(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Tela {
  constructor(largura = 16, altura = 16) {
    this.l = largura;
    this.a = altura;
    this.px = new Uint8ClampedArray(largura * altura * 4);
  }

  dentro(x, y) {
    return x >= 0 && y >= 0 && x < this.l && y < this.a;
  }

  alfa(x, y) {
    return this.dentro(x, y) ? this.px[(y * this.l + x) * 4 + 3] : 0;
  }

  /** Pinta um pixel. Cor com alfa abaixo de 255 mistura com o que já está lá. */
  p(x, y, cor) {
    if (!cor || !this.dentro(x, y)) return this;
    const [r, g, b, a] = rgba(cor);
    const i = (y * this.l + x) * 4;
    if (a === 255 || this.px[i + 3] === 0) {
      this.px.set([r, g, b, a], i);
    } else {
      const f = a / 255;
      this.px[i] = this.px[i] * (1 - f) + r * f;
      this.px[i + 1] = this.px[i + 1] * (1 - f) + g * f;
      this.px[i + 2] = this.px[i + 2] * (1 - f) + b * f;
    }
    return this;
  }

  ret(x, y, l, a, cor) {
    for (let j = y; j < y + a; j++) for (let i = x; i < x + l; i++) this.p(i, j, cor);
    return this;
  }

  h(x, y, l, cor) {
    return this.ret(x, y, l, 1, cor);
  }

  v(x, y, a, cor) {
    return this.ret(x, y, 1, a, cor);
  }

  /**
   * Desenha um mapa de caracteres: cada caractere é uma cor da `legenda`; '.' e ' ' ficam transparentes.
   * 'o' é o contorno, se a legenda não disser outra coisa.
   */
  mapa(linhas, legenda, ox = 0, oy = 0) {
    const leg = { o: CONTORNO, ...legenda };
    const torta = linhas.findIndex((l) => l.length !== linhas[0].length);
    if (torta >= 0) throw new Error(`linha ${torta} com ${linhas[torta].length} colunas, a primeira tem ${linhas[0].length}`);
    linhas.forEach((linha, y) => {
      [...linha].forEach((c, x) => {
        if (c === '.' || c === ' ') return;
        if (!(c in leg)) throw new Error(`caractere sem cor: "${c}" na linha ${y}`);
        this.p(ox + x, oy + y, leg[c]);
      });
    });
    return this;
  }

  /** Contorno de 1 pixel em volta do que é opaco (cruz de 4 vizinhos), só nos pixels vazios. */
  contorno(cor = CONTORNO) {
    const marcar = [];
    for (let y = 0; y < this.a; y++) {
      for (let x = 0; x < this.l; x++) {
        if (this.alfa(x, y) > 0) continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.alfa(x + dx, y + dy) === 255)) marcar.push([x, y]);
      }
    }
    for (const [x, y] of marcar) this.p(x, y, cor);
    return this;
  }

  /** Sombra no chão: uma elipse translúcida que só ocupa pixels vazios. */
  sombra(cx, cy, rx, ry, cor = SOMBRA) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
        if (d <= 1 && this.alfa(x, y) === 0) this.p(x, y, cor);
      }
    }
    return this;
  }

  /** Mistura outra tela por cima, com deslocamento. */
  colar(outra, ox = 0, oy = 0) {
    for (let y = 0; y < outra.a; y++) {
      for (let x = 0; x < outra.l; x++) {
        const i = (y * outra.l + x) * 4;
        if (outra.px[i + 3] === 0) continue;
        const [r, g, b, a] = outra.px.slice(i, i + 4);
        this.p(ox + x, oy + y, '#' + [r, g, b, a].map((n) => n.toString(16).padStart(2, '0')).join(''));
      }
    }
    return this;
  }

  png() {
    return codificarPng(this.l, this.a, this.px);
  }
}
