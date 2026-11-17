import type { ChamadaRegistrada, MissaoGravada, Resultado } from '@nave/shared';

/*
 * Funções puras do painel de créditos de API. O componente fica em componentes/Creditos.tsx.
 * Só entram missões feitas pela API: o motor falso não chama o Claude e a assinatura não cobra por chamada.
 */

export type AgenteClaude = ChamadaRegistrada['agente'];
export const AGENTES_CLAUDE: AgenteClaude[] = ['pesquisador', 'redator', 'revisor'];

/** Uma missão no painel: o produto, de onde veio e as chamadas ao Claude que deram certo. */
export interface RegistroMissao {
  id: string;
  titulo: string;
  loja: string;
  origem: 'gravada' | 'ao_vivo';
  modelo: string;
  chamadas: ChamadaRegistrada[];
}

export interface Gasto { usd: number; tokensEntrada: number; tokensSaida: number; chamadas: number }
export interface GastoAgente extends Gasto { agente: AgenteClaude; fatia: number }
export interface LinhaMissao extends RegistroMissao { porAgente: Record<AgenteClaude, Gasto>; total: Gasto }
export interface Resumo { total: Gasto; missoes: number; porAgente: GastoAgente[]; porMissao: LinhaMissao[] }

const ZERO: Gasto = { usd: 0, tokensEntrada: 0, tokensSaida: 0, chamadas: 0 };

function somar(chamadas: ChamadaRegistrada[]): Gasto {
  return chamadas.reduce((g, c) => ({
    usd: g.usd + c.custoUsd,
    tokensEntrada: g.tokensEntrada + c.tokensEntrada,
    tokensSaida: g.tokensSaida + c.tokensSaida,
    chamadas: g.chamadas + 1,
  }), ZERO);
}

/** O registro de uma missão concluída, ou null se ela não gastou crédito de API (motor falso ou assinatura). */
export function registroDoResultado(r: Resultado, id: string, origem: RegistroMissao['origem']): RegistroMissao | null {
  if (r.motor !== 'api') return null;
  return {
    id,
    titulo: r.original.titulo || r.fichaNova.titulo,
    loja: r.original.loja ?? 'texto colado',
    origem,
    modelo: r.modelo,
    chamadas: r.chamadas,
  };
}

/** O registro de uma missão gravada, tirado do evento `missao_concluida`. */
export function registroDaGravada(m: MissaoGravada): RegistroMissao | null {
  const fim = m.eventos.find((e) => e.tipo === 'missao_concluida');
  if (!fim || fim.tipo !== 'missao_concluida') return null;
  const r = registroDoResultado(fim.resultado, `gravada:${m.nome}`, 'gravada');
  return r && { ...r, titulo: m.titulo, loja: m.loja };
}

/** Total geral, por agente (com a fatia de cada um no total) e por missão (cada agente em cada missão). */
export function resumir(registros: RegistroMissao[]): Resumo {
  const todas = registros.flatMap((r) => r.chamadas);
  const total = somar(todas);
  const porAgente = AGENTES_CLAUDE.map((agente): GastoAgente => {
    const g = somar(todas.filter((c) => c.agente === agente));
    return { agente, ...g, fatia: total.usd > 0 ? g.usd / total.usd : 0 };
  });
  const porMissao = registros.map((r): LinhaMissao => ({
    ...r,
    porAgente: Object.fromEntries(AGENTES_CLAUDE.map((a) => [a, somar(r.chamadas.filter((c) => c.agente === a))])) as Record<AgenteClaude, Gasto>,
    total: somar(r.chamadas),
  }));
  return { total, missoes: registros.length, porAgente, porMissao };
}

/** US$ com vírgula: centavos a partir de 1 dólar; abaixo disso, 4 casas, porque cada chamada custa frações de centavo. */
export function formatarUsd(usd: number): string {
  const casas = usd >= 1 ? 2 : 4;
  return `US$ ${usd.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}`;
}

/** 980 → "980"; 15.234 → "15,2 mil"; 2.500.000 → "2,5 mi". */
export function formatarTokens(n: number): string {
  const f = (x: number) => x.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  if (n >= 1_000_000) return `${f(n / 1_000_000)} mi`;
  if (n >= 1_000) return `${f(n / 1_000)} mil`;
  return String(n);
}

/* ---------- Missões ao vivo guardadas neste navegador ---------- */

export const CHAVE_AO_VIVO = 'nave:creditos:ao-vivo:v1';
export const MAX_AO_VIVO = 50;

function ehChamada(c: unknown): c is ChamadaRegistrada {
  if (typeof c !== 'object' || c === null) return false;
  const o = c as Record<string, unknown>;
  return AGENTES_CLAUDE.includes(o.agente as AgenteClaude) && (o.tentativa === 1 || o.tentativa === 2)
    && [o.tokensEntrada, o.tokensSaida, o.custoUsd, o.ms].every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0);
}

function ehRegistro(r: unknown): r is RegistroMissao {
  if (typeof r !== 'object' || r === null) return false;
  const o = r as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.titulo === 'string' && typeof o.loja === 'string'
    && o.origem === 'ao_vivo' && typeof o.modelo === 'string' && Array.isArray(o.chamadas) && o.chamadas.every(ehChamada);
}

/** Lê as missões ao vivo guardadas. Texto ausente, quebrado ou de outro formato vira lista vazia; registro estranho é descartado. */
export function lerAoVivo(texto: string | null): RegistroMissao[] {
  if (!texto) return [];
  try {
    const dados: unknown = JSON.parse(texto);
    return Array.isArray(dados) ? dados.filter(ehRegistro).slice(0, MAX_AO_VIVO) : [];
  } catch {
    return [];
  }
}

/** Põe a missão nova na frente (a mais recente primeiro), sem repetir o id, e guarda no máximo `MAX_AO_VIVO`. */
export function juntarAoVivo(lista: RegistroMissao[], novo: RegistroMissao): RegistroMissao[] {
  return [novo, ...lista.filter((r) => r.id !== novo.id)].slice(0, MAX_AO_VIVO);
}
