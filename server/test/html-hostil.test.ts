import { describe, it, expect } from 'vitest';
import type { FichaOriginal } from '@nave/shared';
import { extrairJsonLd } from '../src/jsonld';
import { calcularNota, entradaAntes } from '../src/nota';
import { normalizarProdutoShopify } from '../src/shopify';
import { htmlParaTexto, normalizar, ondeEsta } from '../src/texto';
import { pesquisaBoa } from './fixtures/respostas';

/** O tamanho máximo que a leitura da loja aceita. */
const DOIS_MB = 2_000_000;
const LIMITE_MS = 300;
/** O código quadrático levava minutos nesses casos; o timeout do teste é só uma rede de segurança. */
const TEMPO_TESTE = 10_000;
const ABRE_JSONLD = '<script type="application/ld+json">';

const CASOS: [string, string][] = [
  ['2 MB de "<"', '<'.repeat(DOIS_MB)],
  ['2 MB de "<p"', '<p'.repeat(DOIS_MB / 2)],
  ['2 MB de <li> sem fechamento', '<li>'.repeat(DOIS_MB / 4)],
  ['2 MB de "<script " depois de um <script ld+json> sem fechamento', ABRE_JSONLD + '<script '.repeat(DOIS_MB / 8)],
  ['2 MB de <script ld+json> sem fechamento', ABRE_JSONLD.repeat(Math.ceil(DOIS_MB / ABRE_JSONLD.length))],
];

function fichaCom(p: Partial<FichaOriginal>): FichaOriginal {
  return {
    fonte: 'shopify', url: null, loja: null, titulo: 'X', descricaoHtml: '', descricaoTexto: '',
    marca: null, tipo: null, tags: [], opcoes: [], variantes: [], imagens: [],
    moeda: null, jsonldPaginaValido: false, naoVerificavel: [], truncada: false, ...p,
  };
}

function medir(f: () => unknown): number {
  const inicio = performance.now();
  f();
  return performance.now() - inicio;
}

describe('HTML hostil de 2 MB não trava o servidor', () => {
  it.each(CASOS)('%s: normalizar o produto e dar a nota antes leva menos de 300 ms', (_, html) => {
    const ms = medir(() => {
      const o = normalizarProdutoShopify({ product: { title: 'X', body_html: html } }, 'https://l.com/products/x', html);
      calcularNota(entradaAntes(o, pesquisaBoa));
    });
    expect(ms).toBeLessThan(LIMITE_MS);
  }, TEMPO_TESTE);

  it.each(CASOS)('%s: extrairJsonLd leva menos de 300 ms', (_, html) => {
    expect(medir(() => extrairJsonLd(html))).toBeLessThan(LIMITE_MS);
  }, TEMPO_TESTE);

  it.each(CASOS)('%s: htmlParaTexto e normalizar, sem corte, levam menos de 300 ms', (_, html) => {
    expect(medir(() => normalizar(htmlParaTexto(html)))).toBeLessThan(LIMITE_MS);
  }, TEMPO_TESTE);

  it.each(CASOS)('%s: ondeEsta, sem corte, leva menos de 300 ms', (_, html) => {
    const f = fichaCom({ descricaoHtml: html });
    expect(medir(() => ondeEsta(f, 'cerâmica esmaltada'))).toBeLessThan(LIMITE_MS);
  }, TEMPO_TESTE);
});
