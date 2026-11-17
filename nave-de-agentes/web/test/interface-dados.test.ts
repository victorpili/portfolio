import { describe, expect, it } from 'vitest';
import { deveAcordarDeNovo, editandoCampo, estaNoFim, rotuloIniciar } from '../src/interface-dados';

describe('rotuloIniciar', () => {
  it('servidor pronto e sem missão: Iniciar missão', () => {
    expect(rotuloIniciar('pronto', null)).toBe('Iniciar missão');
  });

  it('aquecendo e fora valem mesmo com missão em curso', () => {
    expect(rotuloIniciar('aquecendo', null)).toBe('aquecendo os motores…');
    expect(rotuloIniciar('fora', null)).toBe('missão ao vivo indisponível agora');
    expect(rotuloIniciar('fora', 'gravada')).toBe('missão ao vivo indisponível agora');
  });

  it('durante a missão ao vivo e durante a gravada', () => {
    expect(rotuloIniciar('pronto', 'ao_vivo')).toBe('missão em andamento…');
    expect(rotuloIniciar('pronto', 'gravada')).toBe('aguarde a missão gravada terminar…');
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

describe('editandoCampo (o painel não rouba o foco de quem digita)', () => {
  it('campo de texto, área de texto e lista', () => {
    expect(editandoCampo({ tagName: 'INPUT' })).toBe(true);
    expect(editandoCampo({ tagName: 'TEXTAREA' })).toBe(true);
    expect(editandoCampo({ tagName: 'SELECT' })).toBe(true);
  });

  it('botão, corpo da página ou nada', () => {
    expect(editandoCampo({ tagName: 'BUTTON' })).toBe(false);
    expect(editandoCampo({ tagName: 'BODY' })).toBe(false);
    expect(editandoCampo(null)).toBe(false);
  });
});

describe('deveAcordarDeNovo (depois da missão ao vivo)', () => {
  it('conexão perdida e servidor fora: acorda de novo', () => {
    expect(deveAcordarDeNovo('conexao_perdida')).toBe(true);
    expect(deveAcordarDeNovo('api_fora')).toBe(true);
  });

  it('missão concluída ou erro de entrada: não', () => {
    expect(deveAcordarDeNovo(null)).toBe(false);
    expect(deveAcordarDeNovo('url_invalida')).toBe(false);
    expect(deveAcordarDeNovo('cota_esgotada')).toBe(false);
  });
});
