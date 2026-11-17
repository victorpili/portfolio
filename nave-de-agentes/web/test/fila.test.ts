import { afterEach, describe, expect, it, vi } from 'vitest';
import { criarFila, esperaAntesDoProximo } from '../src/fila';
import { ev } from './ev';

afterEach(() => vi.useRealTimers());

describe('fila', () => {
  it('replay comprime esperas longas; caminhada respeita 1300 ms', () => {
    vi.useFakeTimers();
    const aplicados: number[] = [];
    const f = criarFila(() => aplicados.push(Date.now()), 'replay');
    [
      ev({ tipo: 'agente_convocado', agente: 'pesquisador', sala: 'pesquisa', t: 0 }),
      ev({ tipo: 'agente_trabalhando', agente: 'pesquisador', tentativa: 1, t: 100 }),
      ev({ tipo: 'agente_entregou', agente: 'pesquisador', t: 40000 }),
    ].forEach(f.empurrar);
    vi.runAllTimers();
    expect(aplicados.map((x) => x - aplicados[0])).toEqual([0, 1300, 3800]);
  });

  it('ao vivo usa só o mínimo do evento anterior', () => {
    const a = ev({ tipo: 'imediato_devolveu', agente: 'redator', problemas: [], t: 0 });
    const b = ev({ tipo: 'aviso', t: 90000 });
    expect(esperaAntesDoProximo(a, b, 'ao_vivo')).toBe(1500);
    expect(esperaAntesDoProximo(ev({ tipo: 'aviso' }), b, 'ao_vivo')).toBe(250);
    expect(esperaAntesDoProximo(a, b, 'replay')).toBe(2500);
  });

  it('empurrar depois de parar não aplica', () => {
    vi.useFakeTimers();
    const aplicados: number[] = [];
    const f = criarFila((e) => aplicados.push(e.seq), 'ao_vivo');
    f.parar();
    f.empurrar(ev({ tipo: 'aviso', seq: 1 }));
    vi.runAllTimers();
    expect(aplicados).toEqual([]);
  });

  it('parar descarta o que sobrou', () => {
    vi.useFakeTimers();
    const aplicados: number[] = [];
    const f = criarFila((e) => aplicados.push(e.seq), 'ao_vivo');
    f.empurrar(ev({ tipo: 'aviso', seq: 1 }));
    f.empurrar(ev({ tipo: 'aviso', seq: 2 }));
    f.parar();
    vi.runAllTimers();
    expect(aplicados).toEqual([1]);
  });
});
