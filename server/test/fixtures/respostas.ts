import type { FichaOriginal, Pesquisa, FichaNova } from '@nave/shared';
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
