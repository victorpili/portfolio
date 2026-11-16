import type { ItemNota, ItemNotaId, Nota, Resultado } from '@nave/shared';
import { ROTULO_GRUPO } from './textos';

/* Funções puras do painel antes/depois. O componente fica em componentes/Painel.tsx. */

const ORDEM_GRUPOS: ItemNota['grupo'][] = ['identificacao', 'oferta', 'atributos', 'conteudo', 'dados_estruturados'];

export interface LinhaChecklist { id: ItemNotaId; rotulo: string; antes: ItemNota | null; depois: ItemNota | null }
export type Pontos = { pontos: number; maximo: number };
export interface GrupoChecklist { grupo: ItemNota['grupo']; rotulo: string; linhas: LinhaChecklist[]; antes: Pontos; depois: Pontos }

/** O checklist item a item, agrupado na ordem fixa dos grupos, com o antes e o depois de cada item lado a lado. */
export function agruparChecklist(antes: Nota, depois: Nota): GrupoChecklist[] {
  const somar = (itens: ItemNota[]): Pontos =>
    itens.reduce((s, i) => ({ pontos: s.pontos + i.pontos, maximo: s.maximo + i.maximo }), { pontos: 0, maximo: 0 });
  return ORDEM_GRUPOS.map((grupo): GrupoChecklist => {
    const doGrupoAntes = antes.itens.filter((i) => i.grupo === grupo);
    const doGrupoDepois = depois.itens.filter((i) => i.grupo === grupo);
    const ids = [...new Set([...doGrupoAntes, ...doGrupoDepois].map((i) => i.id))];
    const linhas = ids.map((id) => {
      const a = doGrupoAntes.find((i) => i.id === id) ?? null;
      const d = doGrupoDepois.find((i) => i.id === id) ?? null;
      return { id, rotulo: (d ?? a)!.rotulo, antes: a, depois: d };
    });
    return { grupo, rotulo: ROTULO_GRUPO[grupo], linhas, antes: somar(doGrupoAntes), depois: somar(doGrupoDepois) };
  }).filter((g) => g.linhas.length > 0);
}

/** Item fora das duas notas: "não se aplica" ou "não verificável". */
export function foraDaNota(i: ItemNota | null): boolean {
  return i?.situacao === 'nao_se_aplica' || i?.situacao === 'nao_verificavel';
}

/** O rótulo do atributo, tirado da nota (assim o front não carrega o pacote compartilhado inteiro, com o zod). */
export function rotuloAtributo(r: Resultado, id: string): string {
  return r.notaDepois.itens.find((i) => i.id === `atributo:${id}`)?.rotulo ?? id;
}

/** `nave-<slug do título>.json`: sem acentos, minúsculas, hífens, no máximo 60 caracteres no slug. */
export function nomeDoArquivo(titulo: string): string {
  const slug = titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return `nave-${slug || 'ficha'}.json`;
}

/** "claude-opus-5-5" → "Claude Opus 5.5"; o apelido da assinatura ("sonnet") → "Claude Sonnet". */
export function nomeDoModelo(modelo: string): string {
  if (modelo === 'falso') return 'motor falso';
  const m = /^(?:claude-)?(opus|sonnet|haiku)(?:-(\d+)-(\d+))?$/.exec(modelo);
  if (!m) return modelo;
  const familia = `${m[1]![0]!.toUpperCase()}${m[1]!.slice(1)}`;
  return m[2] ? `Claude ${familia} ${m[2]}.${m[3]}` : `Claude ${familia}`;
}

function formatarDuracao(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
}

function formatarCusto(usd: number): string {
  if (usd > 0 && usd < 0.005) return 'menos de US$ 0,01';
  return `≈ US$ ${usd.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Um item dos bastidores: rótulo pequeno, valor e, se houver, uma nota de rodapé. */
export interface ItemBastidor { rotulo: string; valor: string; dica?: string }

/**
 * Os bastidores da missão: devoluções, chamadas, duração, custo e modelo.
 * O custo depende do motor: o falso não tem; a assinatura não mede; a API dá o custo das chamadas que deram certo.
 */
export function descreverBastidores(r: Resultado): ItemBastidor[] {
  const itens: ItemBastidor[] = [
    { rotulo: 'devoluções do Imediato', valor: r.devolucoes === 0 ? 'nenhuma' : String(r.devolucoes) },
    { rotulo: r.motor === 'falso' ? 'chamadas ao motor' : 'chamadas ao modelo', valor: String(r.chamadas.length) },
    { rotulo: 'duração', valor: formatarDuracao(r.duracaoMs) },
  ];
  if (r.motor === 'falso') return [...itens, { rotulo: 'motor', valor: 'falso (sem IA)' }];
  const custo: ItemBastidor = r.motor === 'assinatura'
    ? { rotulo: 'custo', valor: 'coberto pela assinatura (não medido)' }
    : { rotulo: 'custo do modelo', valor: formatarCusto(r.custoUsd), dica: 'não inclui tentativas que falharam' };
  return [...itens, custo, { rotulo: 'modelo', valor: nomeDoModelo(r.modelo) }];
}

/** O fim da frase do placar sobre os itens a confirmar, no singular ou no plural. */
export function fraseAConfirmar(n: number): string {
  if (n === 0) return '.';
  if (n === 1) return ': o item a confirmar vale zero até o lojista responder.';
  return `: os ${n} itens a confirmar valem zero até o lojista responder.`;
}
