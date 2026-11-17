import type { AtributoId } from './atributos';
import type { FichaOriginal } from './ficha';
import type { Pesquisa, FichaNova } from './schemas';
import type { Evento } from './eventos';

export type ItemNotaId = 'marca' | 'sku' | 'gtin' | 'categoria' | 'preco' | 'disponibilidade'
  | `atributo:${AtributoId}` | 'titulo' | 'descricao' | 'faq' | 'alt' | 'jsonld';

export interface ItemNota { id: ItemNotaId; grupo: 'identificacao' | 'oferta' | 'atributos' | 'conteudo' | 'dados_estruturados';
  rotulo: string; pontos: number; maximo: number;
  situacao: 'ok' | 'parcial' | 'ausente' | 'a_confirmar' | 'nao_se_aplica' | 'nao_verificavel' }
export interface Nota { valor: number; obtidos: number; possiveis: number; itens: ItemNota[] }
export interface ChamadaRegistrada { agente: 'pesquisador' | 'redator' | 'revisor'; tentativa: 1 | 2;
  tokensEntrada: number; tokensSaida: number; custoUsd: number; ms: number }
export interface Resultado { original: FichaOriginal; pesquisa: Pesquisa; fichaNova: FichaNova; jsonld: Record<string, unknown>;
  imagens: { src: string; alt: string }[]; notaAntes: Nota; notaDepois: Nota; aConfirmar: FichaNova['aConfirmar']; devolucoes: number;
  chamadas: ChamadaRegistrada[]; custoUsd: number; duracaoMs: number; motor: string; modelo: string }
export interface MissaoGravada { nome: string; titulo: string; loja: string; gravadaEm: string; modelo: string; eventos: Evento[] }
export type IndiceMissoes = { nome: string; titulo: string; loja: string }[];
