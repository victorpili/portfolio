import type { FichaOriginal, Pesquisa, FichaNova, Revisao } from '@nave/shared';
import { htmlParaTexto } from '../../src/texto';

const bodyHtml = '<p>Ideal para café coado.</p><ul><li>Material: cerâmica esmaltada</li><li>Capacidade: 350 ml</li></ul>';

/** FichaOriginal equivalente a normalizarProdutoShopify(caneca.json, url, null). */
export const originalCaneca: FichaOriginal = {
  fonte: 'shopify',
  url: 'https://loja.com/products/caneca-barro',
  loja: 'loja.com',
  titulo: 'Caneca Barro 350 ml',
  descricaoHtml: bodyHtml,
  descricaoTexto: htmlParaTexto(bodyHtml),
  marca: 'Casa Barro',
  tipo: 'Canecas',
  tags: ['caneca', 'cozinha'],
  opcoes: [{ nome: 'Cor', valores: ['Azul', 'Verde'] }],
  variantes: [
    { titulo: 'Azul', sku: 'CB-350-AZ', preco: '89.90', disponivel: true, codigoBarras: '7891234567895' },
    { titulo: 'Verde', sku: 'CB-350-VE', preco: '89.90', disponivel: false, codigoBarras: null },
  ],
  imagens: [{ src: 'https://loja.com/cdn/caneca-barro.jpg', alt: null }],
  moeda: null,
  jsonldPaginaValido: false,
  naoVerificavel: ['jsonld'],
  truncada: false,
};

/** Pesquisa do Pesquisador sobre a caneca: todo trecho é citação literal da ficha original. */
export const pesquisaBoa: Pesquisa = {
  tipoProduto: 'caneca',
  atributos: [
    { id: 'material', valor: 'cerâmica esmaltada', trecho: 'cerâmica esmaltada' },
    { id: 'dimensoes', valor: 'capacidade de 350 ml', trecho: 'Capacidade: 350 ml' },
    { id: 'variacoes', valor: 'azul e verde', trecho: 'Azul' },
    { id: 'uso', valor: 'café coado', trecho: 'Ideal para café coado' },
  ],
  lacunas: [
    { id: 'peso', motivo: 'A ficha não informa o peso.' },
    { id: 'publico', motivo: 'A ficha não informa o público.' },
    { id: 'cuidados', motivo: 'A ficha não informa os cuidados.' },
    { id: 'garantia', motivo: 'A ficha não informa garantia ou troca.' },
  ],
  naoSeAplica: [],
};

/** Pesquisa com o trecho de `material` trocado por uma citação que não existe no original. */
export const pesquisaTrechoFalso: Pesquisa = {
  ...pesquisaBoa,
  atributos: pesquisaBoa.atributos.map((a) => (a.id === 'material' ? { ...a, trecho: 'aço inox' } : a)),
};

/** Ficha nova da caneca, escrita só com o que a pesquisa sustenta. */
export const fichaNovaCaneca: FichaNova = {
  titulo: 'Caneca Barro 350 ml em cerâmica esmaltada, Casa Barro',
  secoes: [
    { id: 's1', titulo: 'Sobre a caneca', texto: 'A Caneca Barro, da Casa Barro, é feita de cerâmica esmaltada e tem capacidade de 350 ml.', fontes: ['material', 'dimensoes'] },
    { id: 's2', titulo: 'Para que serve', texto: 'Ideal para café coado. Disponível nas cores azul e verde.', fontes: ['uso', 'variacoes'] },
  ],
  atributos: [
    { id: 'material', rotulo: 'Material ou composição', valor: 'cerâmica esmaltada' },
    { id: 'dimensoes', rotulo: 'Dimensões', valor: 'capacidade de 350 ml' },
    { id: 'variacoes', rotulo: 'Variações (cores e tamanhos)', valor: 'azul e verde' },
    { id: 'uso', rotulo: 'Uso', valor: 'café coado' },
  ],
  faq: [
    { id: 'f1', pergunta: 'De que material é a caneca?', resposta: 'É de cerâmica esmaltada.', fontes: ['material'] },
    { id: 'f2', pergunta: 'Qual a capacidade?', resposta: 'A capacidade é de 350 ml.', fontes: ['dimensoes'] },
    { id: 'f3', pergunta: 'Em quais cores ela vem?', resposta: 'Em azul e verde.', fontes: ['variacoes'] },
  ],
  aConfirmar: [
    { id: 'peso', pergunta: 'Qual é o peso da caneca?' },
    { id: 'publico', pergunta: 'A caneca é indicada para algum público específico?' },
    { id: 'cuidados', pergunta: 'Pode ir à lava-louças e ao micro-ondas?' },
    { id: 'garantia', pergunta: 'Qual é a política de garantia ou troca?' },
  ],
};

/** Ficha nova com a seção 2 citando `garantia`, que é lacuna na pesquisa: o Imediato devolve. */
export const fichaComFonteFalsa: FichaNova = {
  ...fichaNovaCaneca,
  secoes: fichaNovaCaneca.secoes.map((s) => (s.id === 's2' ? { ...s, fontes: [...s.fontes, 'garantia' as const] } : s)),
};

const sustentado = (item: string, evidencia: string): Revisao['vereditos'][number] =>
  ({ item, veredito: 'sustentado', evidencia, comentario: 'confere com a ficha original' });

/** Revisão da `fichaNovaCaneca`: todo item sustentado, com evidência literal de caneca.json. */
export const revisaoAprova: Revisao = {
  vereditos: [
    sustentado('titulo', 'Caneca Barro 350 ml'),
    sustentado('s1', 'Material: cerâmica esmaltada'),
    sustentado('s2', 'Ideal para café coado'),
    sustentado('f1', 'cerâmica esmaltada'),
    sustentado('f2', 'Capacidade: 350 ml'),
    sustentado('f3', 'Azul'),
    sustentado('atributo:material', 'cerâmica esmaltada'),
    sustentado('atributo:dimensoes', 'Capacidade: 350 ml'),
    sustentado('atributo:variacoes', 'Verde'),
    sustentado('atributo:uso', 'Ideal para café coado'),
  ],
};

/** Igual à `revisaoAprova`, mas a seção 2 fica `sem_fonte`: a ficha não diz que as duas cores estão disponíveis. */
export const revisaoReprovaSecao2: Revisao = {
  vereditos: revisaoAprova.vereditos.map((v) => (v.item === 's2'
    ? { item: 's2', veredito: 'sem_fonte', evidencia: null, comentario: 'a ficha não diz que as duas cores estão disponíveis' }
    : v)),
};
