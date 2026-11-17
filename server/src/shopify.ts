import type { FichaOriginal, CodigoErro, ItemNotaId } from '@nave/shared';
import { validarUrlProduto, buscarSeguro, ErroBusca } from './url-segura';
import { htmlParaTexto } from './texto';
import { extrairJsonLd, camposProduto } from './jsonld';

type Obj = Record<string, any>;

/** O body_html é cortado antes de qualquer regex. */
const MAX_HTML = 100_000;
const MAX_DESCRICAO = 20_000;
const MAX_VARIANTES = 30;
/** Título do texto colado. */
const MAX_TITULO = 150;
const MIN_TEXTO = 80;
// Tetos dos campos da Shopify que vão para os prompts: o que passa é cortado e a ficha fica `truncada`.
const MAX_TITULO_PRODUTO = 300;
const MAX_MARCA_TIPO = 200;
const MAX_TAGS = 50;
const MAX_OPCOES = 10;
const MAX_VALORES = 100;
/** Cada tag, nome de opção e valor de opção. */
const MAX_ITEM = 100;
/** Título, SKU e preço de cada variante. */
const MAX_CAMPO_VARIANTE = 200;

export class ErroEntrada extends Error {
  constructor(public codigo: CodigoErro, mensagem: string) {
    super(mensagem);
    this.name = 'ErroEntrada';
  }
}

const textoOuNull = (x: unknown): string | null => {
  if (typeof x !== 'string' && typeof x !== 'number') return null;
  const s = String(x).trim();
  return s === '' ? null : s;
};
const lista = (x: unknown): Obj[] => (Array.isArray(x) ? x.filter((i): i is Obj => !!i && typeof i === 'object') : []);

/** priceCurrency da primeira oferta do primeiro produto do JSON-LD (oferta objeto, lista ou AggregateOffer). */
function moedaDoJsonLd(produtos: Obj[]): string | null {
  const primeiro = produtos[0];
  if (!primeiro) return null;
  const ofertas = ([] as unknown[]).concat(primeiro.offers || [])
    .filter((o): o is Obj => !!o && typeof o === 'object')
    .flatMap((o) => (o.offers ? ([] as unknown[]).concat(o.offers).filter((x): x is Obj => !!x && typeof x === 'object') : [o]));
  return textoOuNull(ofertas[0]?.priceCurrency);
}

/** Corta textos e listas no teto e lembra se cortou alguma coisa. */
function cortador() {
  let cortou = false;
  const texto = (s: string, max: number): string => {
    if (s.length <= max) return s;
    cortou = true;
    return s.slice(0, max);
  };
  return {
    texto,
    opcional: (s: string | null, max: number): string | null => (s === null ? null : texto(s, max)),
    lista: <T>(xs: T[], max: number): T[] => {
      if (xs.length > max) cortou = true;
      return xs.slice(0, max);
    },
    cortou: () => cortou,
  };
}

export function normalizarProdutoShopify(json: unknown, url: string, html: string | null): FichaOriginal {
  const p: Obj = (json as Obj)?.product ?? {};
  const corta = cortador();
  const bodyHtml = corta.texto(typeof p.body_html === 'string' ? p.body_html : '', MAX_HTML);
  const descricaoTexto = corta.texto(htmlParaTexto(bodyHtml), MAX_DESCRICAO);
  const todasVariantes = lista(p.variants);

  const titulo = corta.texto(textoOuNull(p.title) ?? '', MAX_TITULO_PRODUTO);
  const marca = corta.opcional(textoOuNull(p.vendor), MAX_MARCA_TIPO);
  const tipo = corta.opcional(textoOuNull(p.product_type), MAX_MARCA_TIPO);
  const todasTags: string[] = (Array.isArray(p.tags) ? p.tags : typeof p.tags === 'string' ? p.tags.split(',') : [])
    .map((t: unknown) => textoOuNull(t)).filter((t: string | null): t is string => t !== null);
  const tags = corta.lista(todasTags, MAX_TAGS).map((t) => corta.texto(t, MAX_ITEM));
  const opcoes = corta.lista(lista(p.options), MAX_OPCOES).map((o) => ({
    nome: corta.texto(String(o.name ?? ''), MAX_ITEM),
    valores: corta.lista(Array.isArray(o.values) ? o.values : [], MAX_VALORES).map((v) => corta.texto(String(v), MAX_ITEM)),
  }));
  const variantes = corta.lista(todasVariantes, MAX_VARIANTES).map((v) => ({
    titulo: corta.texto(String(v.title ?? ''), MAX_CAMPO_VARIANTE),
    sku: corta.opcional(textoOuNull(v.sku), MAX_CAMPO_VARIANTE),
    preco: corta.opcional(textoOuNull(v.price), MAX_CAMPO_VARIANTE),
    disponivel: typeof v.available === 'boolean' ? v.available : null,
    codigoBarras: textoOuNull(v.barcode),
  }));

  const imagens = lista(p.images).filter((i) => textoOuNull(i.src)).map((i) => ({ src: String(i.src), alt: textoOuNull(i.alt) }));

  const naoVerificavel: ItemNotaId[] = [];
  if (!todasVariantes.some((v) => 'barcode' in v)) naoVerificavel.push('gtin');
  if (imagens.length > 0 && !lista(p.images).some((i) => 'alt' in i)) naoVerificavel.push('alt');
  if (html === null) naoVerificavel.push('jsonld');

  const produtosPagina = html === null ? [] : extrairJsonLd(html).produtos;
  const jsonldPaginaValido = produtosPagina.some((x) => {
    const c = camposProduto(x);
    return c.marca && c.preco;
  });

  let loja: string | null = null;
  try { loja = new URL(url).hostname; } catch { /* url sem host */ }

  return {
    fonte: 'shopify',
    url,
    loja,
    titulo,
    descricaoHtml: bodyHtml,
    descricaoTexto,
    marca,
    tipo,
    tags,
    opcoes,
    variantes,
    imagens,
    moeda: moedaDoJsonLd(produtosPagina),
    jsonldPaginaValido,
    naoVerificavel,
    truncada: corta.cortou(),
  };
}

export function fichaDeTexto(texto: string): FichaOriginal {
  const aparado = texto.trim();
  if (aparado.length < MIN_TEXTO || aparado.length > MAX_DESCRICAO) {
    throw new ErroEntrada('texto_invalido', `O texto precisa ter de ${MIN_TEXTO} a ${MAX_DESCRICAO} caracteres.`);
  }
  const primeira = aparado.split('\n').map((l) => l.trim()).find((l) => l !== '') ?? '';
  return {
    fonte: 'texto', url: null, loja: null,
    titulo: primeira.slice(0, MAX_TITULO),
    descricaoHtml: '', descricaoTexto: aparado,
    marca: null, tipo: null, tags: [], opcoes: [], variantes: [], imagens: [],
    moeda: null, jsonldPaginaValido: false,
    naoVerificavel: ['marca', 'sku', 'gtin', 'categoria', 'preco', 'disponibilidade', 'alt', 'jsonld'],
    truncada: false,
  };
}

type Busca = typeof buscarSeguro;
const dormir = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

export async function lerProduto(
  url: string,
  deps: { buscar?: Busca; esperar?: (ms: number) => Promise<void> } = {},
): Promise<FichaOriginal> {
  const buscar = deps.buscar ?? buscarSeguro;
  const esperar = deps.esperar ?? dormir;
  const v = validarUrlProduto(url);
  if (!v.ok) throw new ErroEntrada('url_invalida', v.motivo);
  const base = `https://${v.loja}/products/${v.handle}`;

  const bloqueou = (m: string) => new ErroEntrada('loja_bloqueou', m);
  const buscarJson = async () => {
    try {
      return await buscar(`${base}.json`, { aceitar: 'application/json' });
    } catch (e) {
      if (e instanceof ErroBusca && e.motivo === 'host_bloqueado') throw new ErroEntrada('url_invalida', 'Endereço de loja não permitido.');
      throw bloqueou('Não foi possível ler a loja.');
    }
  };

  let resp = await buscarJson();
  if (resp.status === 429) {
    const h = resp.cabecalhos.get('retry-after');
    const espera = h === null || h.trim() === '' ? NaN : Number(h);
    if (!Number.isFinite(espera) || espera < 0 || espera > 3) throw bloqueou('A loja pediu para esperar.');
    await esperar(espera * 1000);
    resp = await buscarJson();
  }
  if (resp.status === 404) throw new ErroEntrada('produto_nao_encontrado', 'Produto não encontrado na loja.');
  if (resp.status !== 200) throw bloqueou(`A loja respondeu ${resp.status}.`);
  let json: unknown;
  try { json = JSON.parse(resp.corpo); } catch { throw bloqueou('A loja não devolveu um produto válido.'); }

  let html: string | null = null;
  try {
    const pagina = await buscar(base, { aceitar: 'text/html' });
    if (pagina.status === 200) html = pagina.corpo;
  } catch { /* a página é opcional */ }

  return normalizarProdutoShopify(json, base, html);
}
