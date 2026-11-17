import { motorApi } from './motores/api';
import { motorAssinatura, PRAZO_ASSINATURA_MS } from './motores/assinatura';
import type { Motor } from './motores/motor';

type Env = Record<string, string | undefined>;

/**
 * A assinatura só serve para testar a nave na máquina local, sem gastar crédito; no Render (`RENDER` definido),
 * `MOTOR=assinatura` é ignorado e vale a API. O prazo longo só vale pela assinatura.
 */
export function escolherMotor(env: Env): { motor: Motor; prazoMs: number | undefined } {
  if (env.MOTOR === 'assinatura' && !env.RENDER) return { motor: motorAssinatura(), prazoMs: PRAZO_ASSINATURA_MS };
  return { motor: motorApi({ modelo: env.MODELO_AO_VIVO ?? 'claude-sonnet-5-5' }), prazoMs: undefined };
}

/** Lê um limite inteiro ≥ 0; valor ruim derruba a subida, porque a cota nunca pode abrir por engano. */
export function lerLimite(env: Env, nome: string, padrao: number): number {
  const bruto = env[nome];
  if (bruto === undefined || bruto === '') return padrao;
  if (!/^\d+$/.test(bruto.trim())) throw new Error(`${nome} deve ser um inteiro maior ou igual a 0 (recebi "${bruto}")`);
  return Number(bruto);
}

function semBarraNoFim(s: string): string {
  let fim = s.length;
  while (fim > 0 && s[fim - 1] === '/') fim--;
  return s.slice(0, fim);
}

/** Origens do CORS, separadas por vírgula. Sem as barras do fim: o navegador manda a origem sem barra. */
export function lerOrigens(env: Env): string[] {
  return (env.ORIGEM_PERMITIDA ?? '').split(',').map((o) => semBarraNoFim(o.trim())).filter(Boolean);
}
