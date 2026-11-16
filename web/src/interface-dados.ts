import type { CodigoErro } from '@nave/shared';

/* Funções puras e tipos da entrada, do terminal e do App. Os componentes ficam em componentes/. */

export type EstadoServidor = 'aquecendo' | 'pronto' | 'fora';
export type OpcaoGravada = { nome: string; rotulo: string };
export type TipoMissao = 'ao_vivo' | 'gravada';

/** O rótulo do botão da missão ao vivo, dado o servidor e a missão em curso (se houver). */
export function rotuloIniciar(servidor: EstadoServidor, emCurso: TipoMissao | null): string {
  if (servidor === 'fora') return 'missão ao vivo indisponível agora';
  if (servidor === 'aquecendo') return 'aquecendo os motores…';
  if (emCurso === 'ao_vivo') return 'missão em andamento…';
  if (emCurso === 'gravada') return 'aguarde a missão gravada terminar…';
  return 'Iniciar missão';
}

/** Folga, em pixels, para ainda contar como "no fim" da rolagem. */
const FOLGA_PX = 24;

/** Se a rolagem está no fim (ou a poucos pixels dele). Conteúdo menor que a caixa conta como no fim. */
export function estaNoFim(el: { scrollTop: number; scrollHeight: number; clientHeight: number }): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= FOLGA_PX;
}

const CAMPOS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Se o foco está num campo em que a pessoa digita ou escolhe: aí o painel não rouba o foco nem rola a página. */
export function editandoCampo(el: { tagName: string } | null): boolean {
  return el !== null && CAMPOS.has(el.tagName);
}

/** Missão ao vivo que terminou assim pode ter derrubado o servidor: vale acordá-lo de novo. */
export function deveAcordarDeNovo(codigo: CodigoErro | null): boolean {
  return codigo === 'conexao_perdida' || codigo === 'api_fora';
}
