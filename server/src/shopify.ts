import type { FichaOriginal, CodigoErro, ItemNotaId } from '@nave/shared';
import { validarUrlProduto, buscarSeguro, ErroBusca } from './url-segura';
import { htmlParaTexto } from './texto';
import { extrairJsonLd, camposProduto } from './jsonld';

type Obj = Record<string, any>;

/** O body_html é cortado antes de qualquer regex. */
const MAX_HTML = 100_000;
const MAX_DESCRICAO = 20_000;
const MAX_VARIANTES = 30;
const MAX_TITULO = 150;
const MIN_TEXTO = 80;

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

export function normalizarProdutoShopify(json: unknown, url: string, html: string | null): FichaOriginal {
  const p: Obj = (json as Obj)?.product ?? {};
  const htmlInteiro = typeof p.body_html === 'string' ? p.body_html : '';
  const bodyHtml = htmlInteiro.slice(0, MAX_HTML);
  const texto = htmlParaTexto(bodyHtml);
  const todasVariantes = lista(p.variants);
  const truncada = htmlInteiro.length > MAX_HTML || texto.length > MAX_DESCRICAO || todasVariantes.length > MAX_VARIANTES;

  const imagens = lista(p.images).filter((i) => textoOuNull(i.src)).map((i) => ({ src: String(i.src), alt: textoOuNull(i.alt) }));
  const tags = (Array.isArray(p.tags) ? p.tags : typeof p.tags === 'string' ? p.tags.split(',') : [])
    .map((t: unknown) => textoOuNull(t)).filter((t: string | null): t is string => t !== null);

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
    titulo: textoOuNull(p.title) ?? '',
    descricaoHtml: bodyHtml,
    descricaoTexto: texto.slice(0, MAX_DESCRICAO),
    marca: textoOuNull(p.vendor),
    tipo: textoOuNull(p.product_type),
    tags,
    opcoes: lista(p.options).map((o) => ({
      nome: String(o.name ?? ''),
      valores: (Array.isArray(o.values) ? o.values : []).map(String),
    })),
    variantes: todasVariantes.slice(0, MAX_VARIANTES).map((v) => ({
      titulo: String(v.title ?? ''),
      sku: textoOuNull(v.sku),
      preco: textoOuNull(v.price),
      disponivel: typeof v.available === 'boolean' ? v.available : null,
      codigoBarras: textoOuNull(v.barcode),
    })),
    imagens,
    moeda: moedaDoJsonLd(produtosPagina),
    jsonldPaginaValido,
    naoVerificavel,
    truncada,
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
