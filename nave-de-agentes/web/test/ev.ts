import type { Evento } from '@nave/shared';

type Parcial = { tipo: Evento['tipo']; seq?: number; t?: number; mensagem?: string } & Record<string, unknown>;

/** Monta um evento com `seq`, `t` e `mensagem` padrão. */
export function ev(p: Parcial): Evento {
  return { seq: 0, t: 0, mensagem: `msg ${p.tipo}`, ...p } as unknown as Evento;
}
