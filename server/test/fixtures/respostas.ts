import type { FichaOriginal } from '@nave/shared';
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
