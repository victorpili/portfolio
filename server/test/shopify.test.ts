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
