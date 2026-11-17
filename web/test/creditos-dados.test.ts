import { describe, expect, it } from 'vitest';
import type { ChamadaRegistrada, MissaoGravada, Resultado } from '@nave/shared';
import {
  formatarTokens, formatarUsd, juntarAoVivo, lerAoVivo, MAX_AO_VIVO, registroDaGravada, registroDoResultado, resumir,
  type RegistroMissao,
} from '../src/creditos-dados';
import exemplo from '../src/dev/missao-exemplo.json';
import pampili from '../public/missoes/pampili.json';

const chamada = (agente: ChamadaRegistrada['agente'], custoUsd: number, tentativa: 1 | 2 = 1): ChamadaRegistrada =>
  ({ agente, tentativa, tokensEntrada: 1000, tokensSaida: 100, custoUsd, ms: 4000 });

const registro = (id: string, chamadas: ChamadaRegistrada[]): RegistroMissao =>
  ({ id, titulo: `Produto ${id}`, loja: 'loja.com', origem: 'ao_vivo', modelo: 'claude-sonnet-5-5', chamadas });

describe('resumir', () => {
  it('soma o total, cada agente (com a fatia) e cada agente em cada missão', () => {
    const r = resumir([
      registro('a', [chamada('pesquisador', 0.01), chamada('redator', 0.02), chamada('revisor', 0.01)]),
      registro('b', [chamada('pesquisador', 0.01), chamada('redator', 0.02), chamada('redator', 0.02, 2), chamada('revisor', 0.01)]),
    ]);
    expect(r.missoes).toBe(2);
    expect(r.total.usd).toBeCloseTo(0.1);
    expect(r.total.chamadas).toBe(7);
    expect(r.total.tokensEntrada).toBe(7000);
    const redator = r.porAgente.find((a) => a.agente === 'redator')!;
    expect(redator.usd).toBeCloseTo(0.06);
    expect(redator.chamadas).toBe(3);
    expect(redator.fatia).toBeCloseTo(0.6);
    expect(r.porMissao[1]!.porAgente.redator.usd).toBeCloseTo(0.04);
    expect(r.porMissao[1]!.porAgente.redator.chamadas).toBe(2);
    expect(r.porMissao[1]!.total.usd).toBeCloseTo(0.06);
  });

  it('sem missões: tudo zero, sem dividir por zero', () => {
    const r = resumir([]);
    expect(r.total.usd).toBe(0);
    expect(r.porAgente.map((a) => a.fatia)).toEqual([0, 0, 0]);
    expect(r.porMissao).toEqual([]);
  });
});

describe('registros', () => {
  it('a missão gravada real entra com o título do índice e as 3 chamadas', () => {
    const r = registroDaGravada(pampili as unknown as MissaoGravada)!;
    expect(r).toMatchObject({ id: 'gravada:pampili', origem: 'gravada', modelo: 'claude-sonnet-5-5', loja: 'pampili.com.br' });
    expect(r.chamadas.map((c) => c.agente)).toEqual(['pesquisador', 'redator', 'revisor']);
  });

  it('motor falso não gasta crédito de API: fica de fora', () => {
    expect(registroDaGravada(exemplo as unknown as MissaoGravada)).toBeNull();
  });

  it('assinatura também fica de fora; texto colado aparece como tal', () => {
    const r = { motor: 'assinatura', original: { titulo: 'X', loja: null }, fichaNova: { titulo: 'X' }, chamadas: [], modelo: 'sonnet' };
    expect(registroDoResultado(r as unknown as Resultado, 'x', 'ao_vivo')).toBeNull();
    expect(registroDoResultado({ ...r, motor: 'api' } as unknown as Resultado, 'x', 'ao_vivo')!.loja).toBe('texto colado');
  });
});

describe('missões ao vivo guardadas', () => {
  it('lê o que guardou; texto quebrado, ausente ou de outro formato vira lista vazia', () => {
    const lista = [registro('a', [chamada('revisor', 0.01)])];
    expect(lerAoVivo(JSON.stringify(lista))).toEqual(lista);
    expect(lerAoVivo(null)).toEqual([]);
    expect(lerAoVivo('{quebrado')).toEqual([]);
    expect(lerAoVivo('{"a":1}')).toEqual([]);
  });

  it('descarta registro estranho (custo negativo, agente desconhecido, origem gravada)', () => {
    const ruins = [
      registro('a', [chamada('revisor', -1)]),
      registro('b', [{ ...chamada('revisor', 0.01), agente: 'capita' as never }]),
      { ...registro('c', []), origem: 'gravada' },
    ];
    const bom = registro('d', [chamada('redator', 0.01)]);
    expect(lerAoVivo(JSON.stringify([...ruins, bom]))).toEqual([bom]);
  });

  it('a mais recente vai na frente, sem repetir o id, até o limite', () => {
    const muitos = Array.from({ length: MAX_AO_VIVO }, (_, i) => registro(String(i), []));
    const junto = juntarAoVivo(muitos, registro('novo', []));
    expect(junto).toHaveLength(MAX_AO_VIVO);
    expect(junto[0]!.id).toBe('novo');
    expect(juntarAoVivo([registro('a', [])], registro('a', [chamada('revisor', 0.02)]))).toHaveLength(1);
  });
});

describe('formatos', () => {
  it('US$ com vírgula: 4 casas abaixo de 1 dólar, 2 a partir dele', () => {
    expect(formatarUsd(0.013118)).toBe('US$ 0,0131');
    expect(formatarUsd(0)).toBe('US$ 0,0000');
    expect(formatarUsd(12.5)).toBe('US$ 12,50');
  });

  it('tokens em mil e milhão', () => {
    expect(formatarTokens(980)).toBe('980');
    expect(formatarTokens(15_234)).toBe('15,2 mil');
    expect(formatarTokens(2_500_000)).toBe('2,5 mi');
  });
});
