import { describe, expect, it } from 'vitest';
import { rotuloIniciar } from '../src/componentes/Entrada';
import { estaNoFim } from '../src/componentes/Terminal';

describe('rotuloIniciar', () => {
  it('servidor pronto e parado: Iniciar missão', () => {
    expect(rotuloIniciar('pronto', false)).toBe('Iniciar missão');
  });

  it('aquecendo e fora', () => {
    expect(rotuloIniciar('aquecendo', false)).toBe('aquecendo os motores…');
    expect(rotuloIniciar('fora', false)).toBe('missão ao vivo indisponível agora');
    expect(rotuloIniciar('fora', true)).toBe('missão ao vivo indisponível agora');
  });

  it('durante a missão', () => {
    expect(rotuloIniciar('pronto', true)).toBe('missão em andamento…');
  });
});

describe('estaNoFim (rolagem do terminal)', () => {
  it('no fim, ou a poucos pixels dele', () => {
    expect(estaNoFim({ scrollTop: 600, scrollHeight: 900, clientHeight: 300 })).toBe(true);
    expect(estaNoFim({ scrollTop: 590, scrollHeight: 900, clientHeight: 300 })).toBe(true);
  });

  it('o usuário subiu para ler', () => {
    expect(estaNoFim({ scrollTop: 200, scrollHeight: 900, clientHeight: 300 })).toBe(false);
  });

  it('conteúdo menor que a caixa conta como no fim', () => {
    expect(estaNoFim({ scrollTop: 0, scrollHeight: 120, clientHeight: 300 })).toBe(true);
  });
});
