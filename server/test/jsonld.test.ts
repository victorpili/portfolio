import { describe, it, expect } from 'vitest';
import { extrairJsonLd, camposProduto, montarJsonLd, jsonLdProdutoValido, montarAlts } from '../src/jsonld';
import { originalCaneca, fichaNovaCaneca } from './fixtures/respostas';

describe('jsonld', () => {
  it('conta blocos e inválidos, achata @graph', () => {
    const html = `<script type="application/ld+json">{"@graph":[{"@type":"Product","name":"A"}]}</script><script type="application/ld+json">{quebrado</script>`;
    expect(extrairJsonLd(html)).toMatchObject({ blocos: 2, invalidos: 1, produtos: [{ name: 'A' }] });
  });
  it('acha o bloco depois de outros scripts e com </SCRIPT> maiúsculo; abertura sem fechamento não conta', () => {
    const html = `<script src="a.js"></script><SCRIPT data-x="1" type='application/ld+json' id="p">{"@type":"Product","name":"A"}</SCRIPT>`
      + `<script type="application/ld+json">{"@type":"Product","name":"B"}`;
    expect(extrairJsonLd(html)).toMatchObject({ blocos: 1, invalidos: 0, produtos: [{ name: 'A' }] });
  });
  it('lê só os primeiros 500 KB da página', () => {
    const bloco = `<script type="application/ld+json">{"@type":"Product","name":"A"}</script>`;
    expect(extrairJsonLd(' '.repeat(500_000 - bloco.length) + bloco).blocos).toBe(1);
    expect(extrairJsonLd(' '.repeat(500_000) + bloco)).toMatchObject({ blocos: 0, produtos: [] });
  });
  it('lê no máximo 10 blocos', () => {
    const blocos = Array.from({ length: 12 }, (_, i) => `<script type="application/ld+json">{"@type":"Product","name":"P${i}"}</script>`);
    const r = extrairJsonLd(blocos.join('\n'));
    expect(r.blocos).toBe(10);
    expect(r.produtos.map((p) => p.name)).toEqual(Array.from({ length: 10 }, (_, i) => `P${i}`));
  });
  it('camposProduto lê marca, preço, gtin e additionalProperty, tolerando lixo', () => {
    const c = camposProduto({ brand: { name: 'X' }, offers: [null, 3, { price: '1', availability: 'x', gtin13: '1' }], additionalProperty: [{}, {}] });
    expect(c).toMatchObject({ marca: true, preco: true, disponibilidade: true, gtin: true, sku: false, additionalProperty: 2 });
  });
  it('monta Product com marca, ofertas e atributos', () => {
    const j = montarJsonLd(originalCaneca, fichaNovaCaneca);
    expect(j).toMatchObject({ '@type': 'Product', name: fichaNovaCaneca.titulo, brand: { name: 'Casa Barro' }, gtin: '7891234567895' });
    expect((j.offers as any[]).map((o) => o.availability)).toEqual(['https://schema.org/InStock', 'https://schema.org/OutOfStock']);
    expect(j.additionalProperty).toContainEqual({ '@type': 'PropertyValue', name: 'Material ou composição', value: 'cerâmica esmaltada' });
    expect(jsonLdProdutoValido(j)).toBe(true);
  });
  it('sem marca não é válido', () => expect(jsonLdProdutoValido(montarJsonLd({ ...originalCaneca, marca: null }, fichaNovaCaneca))).toBe(false));
  it('null não é válido', () => expect(jsonLdProdutoValido(null)).toBe(false));
  it('montarAlts: primeira com título, demais com número', () => {
    const o = { ...originalCaneca, imagens: [{ src: 'a', alt: null }, { src: 'b', alt: null }] };
    expect(montarAlts(o, fichaNovaCaneca)).toEqual([
      { src: 'a', alt: fichaNovaCaneca.titulo },
      { src: 'b', alt: `${fichaNovaCaneca.titulo} — imagem 2` },
    ]);
  });
});
