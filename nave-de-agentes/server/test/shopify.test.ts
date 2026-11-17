import { describe, it, expect, vi } from 'vitest';
import { ErroBusca, type buscarSeguro } from '../src/url-segura';
import { normalizarProdutoShopify, fichaDeTexto, lerProduto } from '../src/shopify';
import caneca from './fixtures/caneca.json';
import { originalCaneca } from './fixtures/respostas';

type Resp = { status: number; cabecalhos?: Headers; corpo?: string } | ErroBusca;

/** Fake sequencial de buscarSeguro: cada chamada consome a próxima resposta ou lança o ErroBusca. */
function buscaFalsa(respostas: Resp[]): typeof buscarSeguro {
  const fila = [...respostas];
  return (async () => {
    const r = fila.shift();
    if (!r) throw new Error('chamada inesperada');
    if (r instanceof ErroBusca) throw r;
    return { status: r.status, cabecalhos: r.cabecalhos ?? new Headers(), corpo: r.corpo ?? '' };
  }) as typeof buscarSeguro;
}

const URL_PRODUTO = 'https://l.com/products/x';
const json = JSON.stringify(caneca);

describe('normalizarProdutoShopify', () => {
  it('normaliza o fixture', () => {
    const f = normalizarProdutoShopify(caneca, 'https://loja.com/products/caneca-barro', null);
    expect(f).toMatchObject({ fonte: 'shopify', titulo: 'Caneca Barro 350 ml', marca: 'Casa Barro', tipo: 'Canecas', truncada: false });
    expect(f.variantes[0]).toMatchObject({ sku: expect.any(String), codigoBarras: '7891234567895', preco: '89.90', disponivel: true });
    expect(f.naoVerificavel).toContain('jsonld');
    expect(f.naoVerificavel).not.toContain('gtin');
  });
  it('bate com originalCaneca', () => {
    expect(normalizarProdutoShopify(caneca, 'https://loja.com/products/caneca-barro', null)).toEqual(originalCaneca);
  });
  it('produto sem descrição, imagens e variantes não quebra', () => {
    const f = normalizarProdutoShopify({ product: { title: 'X', body_html: null, images: [], variants: [], options: [] } }, 'https://l.com/products/x', null);
    expect(f).toMatchObject({ descricaoTexto: '', imagens: [], variantes: [] });
    expect(f.naoVerificavel).not.toContain('alt');
  });
  it('corta ficha enorme e marca truncada', () => {
    const grande = { product: { ...caneca.product, body_html: `<p>${'a'.repeat(30000)}</p>`, variants: Array.from({ length: 45 }, (_, i) => ({ title: `V${i}` })) } };
    const f = normalizarProdutoShopify(grande, 'https://l.com/products/x', null);
    expect(f.descricaoTexto.length).toBe(20000); expect(f.variantes.length).toBe(30); expect(f.truncada).toBe(true);
  });
  it('corta o body_html em 100.000 caracteres antes de ler e marca truncada', () => {
    const noLimite = normalizarProdutoShopify({ product: { title: 'X', body_html: '<br>'.repeat(25_000) } }, URL_PRODUTO, null);
    expect(noLimite).toMatchObject({ descricaoTexto: '', truncada: false });
    expect(noLimite.descricaoHtml).toHaveLength(100_000);
    const f = normalizarProdutoShopify({ product: { title: 'X', body_html: '<br>'.repeat(25_000) + '<li>Peso: 2 kg</li>' } }, URL_PRODUTO, null);
    expect(f.descricaoHtml).toHaveLength(100_000);
    expect(f).toMatchObject({ descricaoTexto: '', truncada: true });
  });
  it('sem chave barcode nem alt: gtin e alt ficam não verificáveis', () => {
    const p = structuredClone(caneca.product) as any;
    p.variants.forEach((v: any) => delete v.barcode);
    p.images.forEach((i: any) => delete i.alt);
    const f = normalizarProdutoShopify({ product: p }, 'https://l.com/products/x', null);
    expect(f.naoVerificavel).toEqual(expect.arrayContaining(['gtin', 'alt']));
  });
  it('tags em lista e vazio vira null', () => {
    const f = normalizarProdutoShopify({ product: { title: 'X', vendor: '', product_type: ' ', tags: ['a', ' b '] } }, 'https://l.com/products/x', null);
    expect(f).toMatchObject({ marca: null, tipo: null, tags: ['a', 'b'] });
  });
  it('JSON-LD da página: moeda e validade', () => {
    const ld = { '@type': 'Product', name: 'X', brand: { name: 'Casa Barro' }, offers: [{ price: '89.90', priceCurrency: 'BRL' }] };
    const html = `<script type="application/ld+json">${JSON.stringify(ld)}</script>`;
    const f = normalizarProdutoShopify(caneca, 'https://l.com/products/x', html);
    expect(f).toMatchObject({ moeda: 'BRL', jsonldPaginaValido: true });
    expect(f.naoVerificavel).not.toContain('jsonld');
    const agg = { '@type': 'Product', offers: { '@type': 'AggregateOffer', offers: [{ priceCurrency: 'USD' }] } };
    const f2 = normalizarProdutoShopify(caneca, 'https://l.com/products/x', `<script type="application/ld+json">${JSON.stringify(agg)}</script>`);
    expect(f2).toMatchObject({ moeda: 'USD', jsonldPaginaValido: false });
  });
});

describe('tetos dos campos que vão para os prompts', () => {
  const x = (n: number, c = 'x') => c.repeat(n);
  const base = caneca.product;
  const variante = base.variants[0];

  it('ficha gigante: cada campo fica no teto e a ficha fica truncada', () => {
    const gigante = {
      product: {
        title: x(400, 't'), vendor: x(300, 'm'), product_type: x(300, 'p'),
        tags: Array.from({ length: 60 }, (_, i) => `tag${i}`.padEnd(150, 'x')),
        options: Array.from({ length: 12 }, (_, i) => ({
          name: `Opção ${i}`.padEnd(150, 'o'),
          values: Array.from({ length: 120 }, (_, j) => `${i}-${j}`.padEnd(150, 'v')),
        })),
        variants: Array.from({ length: 45 }, (_, i) => ({ title: `V${i}`.padEnd(300, 'v'), sku: `S${i}`.padEnd(300, 's'), price: x(300, '9') })),
        body_html: `<p>${x(150_000, 'a')}</p>`,
      },
    };
    const f = normalizarProdutoShopify(gigante, URL_PRODUTO, null);
    expect(f.truncada).toBe(true);
    expect(f.titulo).toBe(x(300, 't'));
    expect(f.marca).toBe(x(200, 'm'));
    expect(f.tipo).toBe(x(200, 'p'));
    expect(f.tags).toHaveLength(50);
    expect(f.tags.every((t) => t.length === 100)).toBe(true);
    expect(f.tags[49]).toBe('tag49'.padEnd(100, 'x'));
    expect(f.opcoes).toHaveLength(10);
    for (const o of f.opcoes) {
      expect(o.nome).toHaveLength(100);
      expect(o.valores).toHaveLength(100);
      expect(o.valores.every((v) => v.length === 100)).toBe(true);
    }
    expect(f.variantes).toHaveLength(30);
    for (const v of f.variantes) {
      expect([v.titulo.length, v.sku?.length, v.preco?.length]).toEqual([200, 200, 200]);
    }
    expect(f.descricaoHtml).toHaveLength(100_000);
    expect(f.descricaoTexto).toHaveLength(20_000);
  });

  it.each([
    ['título', { title: x(301) }],
    ['marca', { vendor: x(201) }],
    ['tipo', { product_type: x(201) }],
    ['51 tags', { tags: Array.from({ length: 51 }, (_, i) => `t${i}`) }],
    ['tag longa', { tags: [x(101)] }],
    ['11 opções', { options: Array.from({ length: 11 }, (_, i) => ({ name: `O${i}`, values: ['a'] })) }],
    ['nome de opção longo', { options: [{ name: x(101), values: ['a'] }] }],
    ['101 valores', { options: [{ name: 'Cor', values: Array.from({ length: 101 }, (_, i) => `v${i}`) }] }],
    ['valor longo', { options: [{ name: 'Cor', values: [x(101)] }] }],
    ['título de variante', { variants: [{ ...variante, title: x(201) }] }],
    ['SKU', { variants: [{ ...variante, sku: x(201) }] }],
    ['preço', { variants: [{ ...variante, price: x(201) }] }],
  ])('%s acima do teto: corta e marca truncada', (_, campo) => {
    expect(normalizarProdutoShopify({ product: { ...base, ...campo } }, URL_PRODUTO, null).truncada).toBe(true);
  });

  it('no teto exato, nada é cortado nem marcado', () => {
    const p = {
      ...base, title: x(300), vendor: x(200), product_type: x(200),
      tags: Array.from({ length: 50 }, (_, i) => `${i}`.padEnd(100, 'x')),
      options: Array.from({ length: 10 }, (_, i) => ({ name: `${i}`.padEnd(100, 'o'), values: Array.from({ length: 100 }, (_, j) => `${j}`.padEnd(100, 'v')) })),
      variants: Array.from({ length: 30 }, () => ({ ...variante, title: x(200), sku: x(200), price: x(200) })),
    };
    const f = normalizarProdutoShopify({ product: p }, URL_PRODUTO, null);
    expect(f).toMatchObject({ truncada: false, titulo: p.title, marca: p.vendor, tipo: p.product_type, tags: p.tags });
    expect(f.opcoes).toEqual(p.options.map((o) => ({ nome: o.name, valores: o.values })));
    expect(f.variantes).toHaveLength(30);
    expect(f.variantes[29]).toMatchObject({ titulo: x(200), sku: x(200), preco: x(200) });
  });
});

describe('fichaDeTexto', () => {
  it('curto falha, válido marca 8 itens não verificáveis', () => {
    expect(() => fichaDeTexto('curto')).toThrow(expect.objectContaining({ codigo: 'texto_invalido' }));
    expect(() => fichaDeTexto('x'.repeat(20001))).toThrow(expect.objectContaining({ codigo: 'texto_invalido' }));
    expect(fichaDeTexto('Caneca de cerâmica\n' + 'x'.repeat(100)).naoVerificavel).toHaveLength(8);
  });
  it('título é a primeira linha não vazia, cortada em 150', () => {
    expect(fichaDeTexto('\n\n  Caneca linda  \n' + 'x'.repeat(100)).titulo).toBe('Caneca linda');
    expect(fichaDeTexto('t'.repeat(200) + '\n' + 'x'.repeat(100)).titulo).toHaveLength(150);
  });
});

describe('lerProduto', () => {
  it.each([[403, 'loja_bloqueou'], [404, 'produto_nao_encontrado']])('status %i vira %s', async (status, codigo) => {
    await expect(lerProduto(URL_PRODUTO, { buscar: buscaFalsa([{ status }]) })).rejects.toMatchObject({ codigo });
  });
  it('URL inválida e host bloqueado viram url_invalida', async () => {
    await expect(lerProduto('http://l.com/x')).rejects.toMatchObject({ codigo: 'url_invalida' });
    await expect(lerProduto(URL_PRODUTO, { buscar: buscaFalsa([new ErroBusca('host_bloqueado')]) })).rejects.toMatchObject({ codigo: 'url_invalida' });
  });
  it('JSON inválido, 5xx e outros ErroBusca viram loja_bloqueou', async () => {
    for (const r of [{ status: 200, corpo: '<html>' }, { status: 500 }, new ErroBusca('tempo_esgotado')] as Resp[])
      await expect(lerProduto(URL_PRODUTO, { buscar: buscaFalsa([r]) })).rejects.toMatchObject({ codigo: 'loja_bloqueou' });
  });
  it('429 com Retry-After 2 tenta de novo; com 10 desiste', async () => {
    const esperar = vi.fn(async () => {});
    const f = await lerProduto(URL_PRODUTO, {
      esperar,
      buscar: buscaFalsa([{ status: 429, cabecalhos: new Headers({ 'Retry-After': '2' }) }, { status: 200, corpo: json }, { status: 403 }]),
    });
    expect(esperar).toHaveBeenCalledWith(2000);
    expect(f.titulo).toBe('Caneca Barro 350 ml');
    const esperar2 = vi.fn(async () => {});
    await expect(lerProduto(URL_PRODUTO, { esperar: esperar2, buscar: buscaFalsa([{ status: 429, cabecalhos: new Headers({ 'Retry-After': '10' }) }]) }))
      .rejects.toMatchObject({ codigo: 'loja_bloqueou' });
    expect(esperar2).not.toHaveBeenCalled();
  });
  it.each([[undefined], ['']])('429 com Retry-After ausente ou vazio (%j) vira loja_bloqueou sem esperar', async (h) => {
    const esperar = vi.fn(async () => {});
    const cabecalhos = new Headers(h === undefined ? {} : { 'Retry-After': h });
    await expect(lerProduto(URL_PRODUTO, { esperar, buscar: buscaFalsa([{ status: 429, cabecalhos }]) }))
      .rejects.toMatchObject({ codigo: 'loja_bloqueou' });
    expect(esperar).not.toHaveBeenCalled();
  });
  it('só tenta de novo uma vez', async () => {
    const r429 = { status: 429, cabecalhos: new Headers({ 'Retry-After': '1' }) };
    await expect(lerProduto(URL_PRODUTO, { esperar: async () => {}, buscar: buscaFalsa([r429, r429]) })).rejects.toMatchObject({ codigo: 'loja_bloqueou' });
  });
  it('HTML que falha não derruba a leitura', async () => {
    const f = await lerProduto(URL_PRODUTO, { buscar: buscaFalsa([{ status: 200, corpo: json }, { status: 403 }]) });
    expect(f.naoVerificavel).toContain('jsonld');
    const g = await lerProduto(URL_PRODUTO, { buscar: buscaFalsa([{ status: 200, corpo: json }, new ErroBusca('tempo_esgotado')]) });
    expect(g.naoVerificavel).toContain('jsonld');
  });
  it('usa o HTML da página quando existe', async () => {
    const ld = { '@type': 'Product', brand: 'Casa Barro', offers: { price: '1', priceCurrency: 'BRL' } };
    const html = `<script type="application/ld+json">${JSON.stringify(ld)}</script>`;
    const f = await lerProduto(URL_PRODUTO, { buscar: buscaFalsa([{ status: 200, corpo: json }, { status: 200, corpo: html }]) });
    expect(f).toMatchObject({ moeda: 'BRL', jsonldPaginaValido: true, loja: 'l.com' });
  });
});
