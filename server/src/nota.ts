import { ATRIBUTOS, type AtributoId, type FichaNova, type FichaOriginal, type ItemNota, type ItemNotaId, type Nota, type Pesquisa } from '@nave/shared';
import { normalizar, ondeEsta } from './texto';
import { jsonLdProdutoValido } from './jsonld';

export type SituacaoAtributo = 'estruturado' | 'texto' | 'ausente' | 'a_confirmar' | 'nao_se_aplica';

export interface EntradaNota {
  marca: boolean; sku: boolean; gtin: boolean; categoria: boolean; preco: boolean; disponibilidade: boolean;
  atributos: Record<AtributoId, SituacaoAtributo>;
  titulo: string; tipoProduto: string; marcaNome: string | null;
  descricaoOrganizada: boolean; faqQtd: number; imagensComAlt: boolean; jsonldProduto: boolean;
  naoVerificavel: ItemNotaId[];
}

type Grupo = ItemNota['grupo'];

function item(e: EntradaNota, id: ItemNotaId, grupo: Grupo, rotulo: string, maximo: number, ganha: boolean): ItemNota {
  if (e.naoVerificavel.includes(id)) return { id, grupo, rotulo, pontos: 0, maximo: 0, situacao: 'nao_verificavel' };
  return { id, grupo, rotulo, pontos: ganha ? maximo : 0, maximo, situacao: ganha ? 'ok' : 'ausente' };
}

function itemAtributo(e: EntradaNota, id: AtributoId, rotulo: string): ItemNota {
  const base = { id: `atributo:${id}` as const, grupo: 'atributos' as const, rotulo };
  const s = e.atributos[id];
  if (s === 'nao_se_aplica') return { ...base, pontos: 0, maximo: 0, situacao: 'nao_se_aplica' };
  if (s === 'estruturado') return { ...base, pontos: 5, maximo: 5, situacao: 'ok' };
  if (s === 'texto') return { ...base, pontos: 2, maximo: 5, situacao: 'parcial' };
  return { ...base, pontos: 0, maximo: 5, situacao: s };
}

function tituloBom(e: EntradaNota): boolean {
  if (e.titulo.length < 20 || e.titulo.length > 150) return false;
  const t = normalizar(e.titulo);
  return [e.tipoProduto, e.marcaNome].some((x) => {
    const n = x ? normalizar(x) : '';
    return n !== '' && t.includes(n);
  });
}

export function calcularNota(e: EntradaNota): Nota {
  const itens: ItemNota[] = [
    item(e, 'marca', 'identificacao', 'Marca', 5, e.marca),
    item(e, 'sku', 'identificacao', 'SKU', 5, e.sku),
    item(e, 'gtin', 'identificacao', 'GTIN / código de barras', 5, e.gtin),
    item(e, 'categoria', 'identificacao', 'Categoria', 5, e.categoria),
    item(e, 'preco', 'oferta', 'Preço', 5, e.preco),
    item(e, 'disponibilidade', 'oferta', 'Disponibilidade', 5, e.disponibilidade),
    ...ATRIBUTOS.map((a) => itemAtributo(e, a.id, a.rotulo)),
    item(e, 'titulo', 'conteudo', 'Título descritivo', 5, tituloBom(e)),
    item(e, 'descricao', 'conteudo', 'Descrição organizada', 5, e.descricaoOrganizada),
    item(e, 'faq', 'conteudo', 'FAQ (3+ perguntas)', 5, e.faqQtd >= 3),
    item(e, 'alt', 'conteudo', 'Imagens com texto alternativo', 5, e.imagensComAlt),
    item(e, 'jsonld', 'dados_estruturados', 'JSON-LD Product', 10, e.jsonldProduto),
  ];
  const obtidos = itens.reduce((s, i) => s + i.pontos, 0);
  const possiveis = itens.reduce((s, i) => s + i.maximo, 0);
  return { valor: possiveis === 0 ? 0 : Math.round((obtidos / possiveis) * 100), obtidos, possiveis, itens };
}

function identificacao(o: FichaOriginal) {
  return {
    marca: !!o.marca?.trim(),
    sku: o.variantes.some((v) => !!v.sku?.trim()),
    gtin: o.variantes.some((v) => !!v.codigoBarras?.trim()),
    categoria: !!o.tipo?.trim(),
    preco: o.variantes.some((v) => !!v.preco?.trim()),
    disponibilidade: o.variantes.some((v) => v.disponivel !== null),
  };
}

function atributosDe(p: Pesquisa, resolver: (id: AtributoId) => SituacaoAtributo): Record<AtributoId, SituacaoAtributo> {
  return Object.fromEntries(ATRIBUTOS.map((a) => [a.id, p.naoSeAplica.some((x) => x.id === a.id) ? 'nao_se_aplica' : resolver(a.id)])) as Record<AtributoId, SituacaoAtributo>;
}

export function entradaAntes(o: FichaOriginal, p: Pesquisa): EntradaNota {
  const html = o.descricaoHtml;
  const titulos = html.match(/<h[1-6]\b/gi)?.length ?? 0;
  return {
    ...identificacao(o),
    atributos: atributosDe(p, (id) => {
      const a = p.atributos.find((x) => x.id === id);
      return a ? ondeEsta(o, a.trecho) ?? 'ausente' : 'ausente';
    }),
    titulo: o.titulo, tipoProduto: p.tipoProduto, marcaNome: o.marca,
    descricaoOrganizada: /<(ul|ol|table)\b/i.test(html) || titulos >= 2,
    faqQtd: 0,
    imagensComAlt: o.imagens.length >= 1 && o.imagens.every((i) => !!i.alt?.trim()),
    jsonldProduto: o.jsonldPaginaValido,
    naoVerificavel: o.naoVerificavel,
  };
}

export function entradaDepois(o: FichaOriginal, p: Pesquisa, n: FichaNova, jsonld: Record<string, unknown>): EntradaNota {
  return {
    ...identificacao(o),
    atributos: atributosDe(p, (id) => n.atributos.some((x) => x.id === id) ? 'estruturado'
      : n.aConfirmar.some((x) => x.id === id) ? 'a_confirmar' : 'ausente'),
    titulo: n.titulo, tipoProduto: p.tipoProduto, marcaNome: o.marca,
    descricaoOrganizada: n.secoes.length >= 2,
    faqQtd: n.faq.length,
    imagensComAlt: o.imagens.length >= 1,
    jsonldProduto: jsonLdProdutoValido(jsonld),
    naoVerificavel: o.naoVerificavel,
  };
}
