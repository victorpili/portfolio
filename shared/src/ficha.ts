import type { ItemNotaId } from './resultado';

export interface FichaOriginal {
  fonte: 'shopify' | 'texto'; url: string | null; loja: string | null;
  titulo: string; descricaoHtml: string; descricaoTexto: string;
  marca: string | null; tipo: string | null; tags: string[];
  opcoes: { nome: string; valores: string[] }[];
  variantes: { titulo: string; sku: string | null; preco: string | null; disponivel: boolean | null; codigoBarras: string | null }[];
  imagens: { src: string; alt: string | null }[];
  moeda: string | null; jsonldPaginaValido: boolean;
  naoVerificavel: ItemNotaId[]; truncada: boolean;
}
