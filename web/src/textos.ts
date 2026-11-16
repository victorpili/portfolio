import type { CodigoErro, Evento, ItemNota } from '@nave/shared';
import { ErroApi } from './api';

/** Título e sugestão de cada erro, na caixa de erro e no terminal. O `Record` obriga a cobrir todos os códigos. */
export const TEXTOS_ERRO: Record<CodigoErro, { titulo: string; sugestao: string }> = {
  entrada_invalida: { titulo: 'A nave não entendeu a entrada', sugestao: 'Envie a URL de um produto ou cole o texto da ficha.' },
  url_invalida: {
    titulo: 'URL de produto inválida',
    sugestao: 'Use o endereço https da página do produto, no formato https://loja.com/products/nome-do-produto.',
  },
  texto_invalido: { titulo: 'Texto fora do tamanho', sugestao: 'Cole de 80 a 20.000 caracteres: o título e a descrição do produto.' },
  loja_bloqueou: { titulo: 'A loja bloqueou a leitura', sugestao: 'Cole o texto da ficha: o título e a descrição do produto.' },
  produto_nao_encontrado: { titulo: 'Produto não encontrado', sugestao: 'Confira a URL ou cole o texto da ficha.' },
  cota_esgotada: { titulo: 'A cota de hoje acabou', sugestao: 'Veja uma missão gravada.' },
  missao_em_andamento: {
    titulo: 'A nave já está numa missão',
    sugestao: 'Tente de novo em instantes ou veja uma missão gravada.',
  },
  sem_credito: { titulo: 'Sem combustível hoje', sugestao: 'A API do Claude ficou sem crédito. Veja uma missão gravada.' },
  api_fora: { titulo: 'A missão falhou no servidor', sugestao: 'Tente de novo em instantes ou veja uma missão gravada.' },
  tempo_esgotado: { titulo: 'A missão passou do tempo', sugestao: 'Tente de novo ou veja uma missão gravada.' },
  conexao_perdida: {
    titulo: 'A conexão com a nave caiu',
    sugestao: 'Confira a internet e tente de novo, ou veja uma missão gravada.',
  },
};

/** O texto de um código; um código que o front não conhece (servidor mais novo) usa o de `api_fora`. */
export function textoDoErro(codigo: string): { titulo: string; sugestao: string } {
  return Object.hasOwn(TEXTOS_ERRO, codigo) ? TEXTOS_ERRO[codigo as CodigoErro] : TEXTOS_ERRO.api_fora;
}

export type EventoErro = Extract<Evento, { tipo: 'erro' }>;

/**
 * Um erro do lado do front vira um evento `erro` local (seq −1), para o redutor mostrar a mensagem e oferecer as gravadas.
 * Erro que não é `ErroApi` é bug: vira `api_fora`, e o texto cru do navegador não aparece.
 */
export function eventoDeErro(err: unknown, agora: number): EventoErro {
  const codigo: CodigoErro = err instanceof ErroApi && Object.hasOwn(TEXTOS_ERRO, err.codigo) ? err.codigo : 'api_fora';
  const { titulo, sugestao } = TEXTOS_ERRO[codigo];
  return { seq: -1, t: agora, tipo: 'erro', codigo, recuperavel: true, mensagem: `Capitã: ${titulo}.`, sugestao };
}

/** Ícone do checklist, o texto para leitor de tela e a dica (no `title` e, no "—", em texto pequeno). */
export const SITUACAO: Record<ItemNota['situacao'], { icone: string; texto: string; dica: string | null }> = {
  ok: { icone: '✓', texto: 'ok', dica: null },
  parcial: { icone: '◐', texto: 'parcial', dica: 'Aparece só no texto corrido, fora de lista ou tabela.' },
  ausente: { icone: '✗', texto: 'ausente', dica: null },
  a_confirmar: { icone: '?', texto: 'a confirmar', dica: 'Sem fonte no original: depende do lojista.' },
  nao_se_aplica: { icone: '—', texto: 'não se aplica', dica: 'Não se aplica a este produto; fica fora das duas notas.' },
  nao_verificavel: { icone: '—', texto: 'não verificável', dica: 'Não deu para conferir no original; fica fora das duas notas.' },
};

export const ROTULO_GRUPO: Record<ItemNota['grupo'], string> = {
  identificacao: 'Identificação',
  oferta: 'Oferta',
  atributos: 'Atributos',
  conteudo: 'Conteúdo',
  dados_estruturados: 'Dados estruturados',
};
